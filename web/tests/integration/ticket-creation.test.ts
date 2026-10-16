import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/tickets/route";
import { prisma } from "@/lib/prisma";
import { classifyTicket, findDuplicates, routeTicket } from "@/lib/ml-client";
import { emitTicketEvent, emitToAdmins } from "@/lib/socket-server";
import { hoursAgo, jsonRequest, loginAs, logout, makeTicket, makeUser } from "./helpers";

const body = { title: "Cannot reset my password", description: "The reset email never arrives, even after checking spam." };
const create = (b: unknown = body) => POST(jsonRequest("POST", b));

const classification = {
  category: "account", priority: "HIGH" as const, confidence: 0.82, embedding: [0.6, 0.8],
};

describe("POST /api/tickets: access and validation", () => {
  it("401 when not logged in", async () => {
    logout();
    expect((await create()).status).toBe(401);
  });

  it.each(["AGENT", "ADMIN"] as const)("403 for role %s (only customers raise tickets)", async (role) => {
    loginAs(await makeUser(role));
    expect((await create()).status).toBe(403);
    expect(await prisma.ticket.count()).toBe(0);
  });

  it("400 for a too-short title", async () => {
    loginAs(await makeUser("USER"));
    expect((await create({ ...body, title: "Hi" })).status).toBe(400);
  });
});

describe("POST /api/tickets: ML service down (fails soft)", () => {
  it("still creates the ticket, unclassified and unassigned", async () => {
    const user = await makeUser("USER");
    await makeUser("AGENT");
    loginAs(user);

    const res = await create();
    expect(res.status).toBe(201);

    const t = await prisma.ticket.findFirstOrThrow();
    expect(t).toMatchObject({
      status: "OPEN", priority: "MEDIUM", categoryId: null, assignedToId: null,
      aiCategory: null, aiConfidence: null, duplicateOfId: null, raisedById: user.id,
    });
    expect(t.embedding).toEqual([]);
    expect(await prisma.assignmentLog.count()).toBe(0);
    expect(routeTicket).not.toHaveBeenCalled();
  });
});

describe("POST /api/tickets: AI classification and routing", () => {
  it("stores the prediction, creates the category, routes to the chosen agent and logs it", async () => {
    const user = await makeUser("USER");
    const agentA = await makeUser("AGENT");
    const agentB = await makeUser("AGENT");
    loginAs(user);
    vi.mocked(classifyTicket).mockResolvedValue(classification);
    vi.mocked(routeTicket).mockResolvedValue({ agentId: agentB.id, score: 0.71, breakdown: null });

    const res = await create();
    expect(res.status).toBe(201);

    const t = await prisma.ticket.findFirstOrThrow({ include: { category: true } });
    expect(t.category).toMatchObject({ slug: "account", name: "Account" });
    expect(t).toMatchObject({
      priority: "HIGH", aiCategory: "account", aiPriority: "HIGH", aiConfidence: 0.82,
      assignedToId: agentB.id, aiSuggestedAgentId: agentB.id,
    });
    expect(t.embedding).toEqual([0.6, 0.8]);

    const log = await prisma.assignmentLog.findFirstOrThrow();
    expect(log).toMatchObject({
      ticketId: t.id, aiSuggestedAgentId: agentB.id, finalAgentId: agentB.id,
      aiSuggestedScore: 0.71, wasOverridden: false,
    });

    // The router is asked about every agent, for the predicted category.
    const [category, candidates] = vi.mocked(routeTicket).mock.calls[0];
    expect(category).toBe("account");
    expect(candidates.map((c) => c.id).sort()).toEqual([agentA.id, agentB.id].sort());
  });

  it("feeds the router each agent's real open-ticket count and defaults for agents with no history", async () => {
    const user = await makeUser("USER");
    const busy = await makeUser("AGENT");
    const idle = await makeUser("AGENT");
    for (const status of ["OPEN", "IN_PROGRESS", "OPEN"] as const) {
      await makeTicket(user.id, { assignedToId: busy.id, status });
    }
    await makeTicket(user.id, { assignedToId: busy.id, status: "RESOLVED" }); // not "open"
    loginAs(user);
    vi.mocked(classifyTicket).mockResolvedValue(classification);
    vi.mocked(routeTicket).mockResolvedValue({ agentId: idle.id, score: 0.9, breakdown: null });

    await create();

    const candidates = vi.mocked(routeTicket).mock.calls[0][1];
    const byId = Object.fromEntries(candidates.map((c) => [c.id, c]));
    expect(byId[busy.id].openCount).toBe(3);
    expect(byId[idle.id].openCount).toBe(0);
    expect(byId[idle.id]).toMatchObject({ avgResolutionMins: 120, accuracyScore: 0.5 });
  });

  it("passes an agent's per-category history to the router", async () => {
    const user = await makeUser("USER");
    const agent = await makeUser("AGENT");
    const cat = await prisma.category.create({ data: { slug: "account", name: "Account" } });
    const profile = await prisma.agentProfile.findUniqueOrThrow({ where: { userId: agent.id } });
    await prisma.agentCategoryStat.create({
      data: { agentProfileId: profile.id, categoryId: cat.id, resolvedCount: 5, avgResolutionMins: 45, accuracyScore: 0.9 },
    });
    loginAs(user);
    vi.mocked(classifyTicket).mockResolvedValue(classification);
    vi.mocked(routeTicket).mockResolvedValue({ agentId: agent.id, score: 0.9, breakdown: null });

    await create();

    expect(vi.mocked(routeTicket).mock.calls[0][1][0]).toMatchObject({
      id: agent.id, avgResolutionMins: 45, accuracyScore: 0.9,
    });
    expect(await prisma.category.count()).toBe(1); // existing category reused, not duplicated
  });

  it("leaves the ticket unassigned when no agents exist yet", async () => {
    loginAs(await makeUser("USER"));
    vi.mocked(classifyTicket).mockResolvedValue(classification);

    expect((await create()).status).toBe(201);

    const t = await prisma.ticket.findFirstOrThrow();
    expect(t.categoryId).not.toBeNull(); // classified...
    expect(t.assignedToId).toBeNull(); // ...but nobody to route to
    expect(routeTicket).not.toHaveBeenCalled();
  });

  it("leaves the ticket unassigned when the router returns no agent", async () => {
    loginAs(await makeUser("USER"));
    await makeUser("AGENT");
    vi.mocked(classifyTicket).mockResolvedValue(classification);
    vi.mocked(routeTicket).mockResolvedValue({ agentId: null, score: null, breakdown: null });

    await create();

    expect((await prisma.ticket.findFirstOrThrow()).assignedToId).toBeNull();
    expect(await prisma.assignmentLog.count()).toBe(0);
  });

  it("broadcasts ticket:created to the requester, assignee and admins", async () => {
    const user = await makeUser("USER");
    const agent = await makeUser("AGENT");
    loginAs(user);
    vi.mocked(classifyTicket).mockResolvedValue(classification);
    vi.mocked(routeTicket).mockResolvedValue({ agentId: agent.id, score: 0.5, breakdown: null });

    await create();

    const t = await prisma.ticket.findFirstOrThrow();
    expect(emitTicketEvent).toHaveBeenCalledWith("ticket:created", {
      ticketId: t.id, raisedById: user.id, assignedToId: agent.id,
    });
    expect(emitToAdmins).toHaveBeenCalledWith("ticket:created", { ticketId: t.id });
  });
});

describe("POST /api/tickets: duplicate detection", () => {
  async function resolvedTicket(userId: string) {
    return makeTicket(userId, {
      title: "Old password problem", status: "RESOLVED", resolutionNote: "Unlocked the account",
      resolvedAt: hoursAgo(1),
    });
  }

  it("flags a match at or above 0.8 and records the similarity", async () => {
    const user = await makeUser("USER");
    const old = await resolvedTicket(user.id);
    loginAs(user);
    vi.mocked(classifyTicket).mockResolvedValue(classification);
    vi.mocked(findDuplicates).mockResolvedValue({ matches: [{ ticketId: old.id, similarity: 0.97 }] });

    await create();

    const t = await prisma.ticket.findFirstOrThrow({ where: { id: { not: old.id } } });
    expect(t).toMatchObject({ duplicateOfId: old.id, similarityScore: 0.97 });
    expect(findDuplicates).toHaveBeenCalledWith(classification.embedding);
  });

  it("does not flag a match just under the threshold", async () => {
    const user = await makeUser("USER");
    const old = await resolvedTicket(user.id);
    loginAs(user);
    vi.mocked(classifyTicket).mockResolvedValue(classification);
    vi.mocked(findDuplicates).mockResolvedValue({ matches: [{ ticketId: old.id, similarity: 0.79 }] });

    await create();

    const t = await prisma.ticket.findFirstOrThrow({ where: { id: { not: old.id } } });
    expect(t.duplicateOfId).toBeNull();
    expect(t.similarityScore).toBeNull();
  });

  it("does not look for duplicates when classification (and so the embedding) is unavailable", async () => {
    loginAs(await makeUser("USER"));
    await create();
    expect(findDuplicates).not.toHaveBeenCalled();
  });
});

describe("POST /api/tickets: concurrency", () => {
  it("several customers raising the first-ever ticket of a new category at the same moment all succeed", async () => {
    const users = await Promise.all([1, 2, 3, 4, 5].map(() => makeUser("USER")));
    vi.mocked(classifyTicket).mockResolvedValue(classification);

    const responses = await Promise.all(
      users.map((u) => {
        loginAs(u); // the mocked session is read synchronously inside requireUser's first await
        return create();
      })
    );

    expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    expect(await prisma.ticket.count()).toBe(5);
    expect(await prisma.category.count()).toBe(1);
  });
});
