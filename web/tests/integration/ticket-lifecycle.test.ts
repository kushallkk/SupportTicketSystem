import { describe, expect, it } from "vitest";
import { PATCH } from "@/app/api/tickets/[id]/route";
import { POST as postComment } from "@/app/api/tickets/[id]/comments/route";
import { POST as postRating } from "@/app/api/tickets/[id]/rating/route";
import { prisma } from "@/lib/prisma";
import { emitTicketEvent } from "@/lib/socket-server";
import { idParams, jsonRequest, loginAs, makeCategory, makeTicket, makeUser, minutesAgo } from "./helpers";

const patch = (id: string, body: unknown) => PATCH(jsonRequest("PATCH", body), idParams(id));
const comment = (id: string, body: unknown) => postComment(jsonRequest("POST", body), idParams(id));
const rate = (id: string, body: unknown) => postRating(jsonRequest("POST", body), idParams(id));

describe("PATCH: agent resolves a ticket", () => {
  it("sets resolvedAt/note and rolls the agent's per-category stats", async () => {
    const user = await makeUser("USER");
    const agent = await makeUser("AGENT");
    const cat = await makeCategory("billing", "Billing");
    const t = await makeTicket(user.id, {
      assignedToId: agent.id, categoryId: cat.id, status: "IN_PROGRESS", createdAt: minutesAgo(60),
    });
    loginAs(agent);

    const res = await patch(t.id, { status: "RESOLVED", resolutionNote: "Refunded the duplicate charge" });
    expect(res.status).toBe(200);

    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(after).toMatchObject({ status: "RESOLVED", resolutionNote: "Refunded the duplicate charge" });
    expect(after.resolvedAt).toBeInstanceOf(Date);

    const profile = await prisma.agentProfile.findUniqueOrThrow({ where: { userId: agent.id } });
    const stat = await prisma.agentCategoryStat.findFirstOrThrow({ where: { agentProfileId: profile.id } });
    expect(stat.resolvedCount).toBe(1);
    expect(stat.avgResolutionMins).toBeGreaterThan(59.5);
    expect(stat.avgResolutionMins).toBeLessThan(62);
  });

  it("keeps a running average across several resolutions", async () => {
    const user = await makeUser("USER");
    const agent = await makeUser("AGENT");
    const cat = await makeCategory("billing", "Billing");
    loginAs(agent);
    for (const age of [60, 120]) {
      const t = await makeTicket(user.id, {
        assignedToId: agent.id, categoryId: cat.id, status: "IN_PROGRESS", createdAt: minutesAgo(age),
      });
      await patch(t.id, { status: "RESOLVED", resolutionNote: "done" });
    }
    const stat = await prisma.agentCategoryStat.findFirstOrThrow();
    expect(stat.resolvedCount).toBe(2);
    expect(stat.avgResolutionMins).toBeGreaterThan(88);
    expect(stat.avgResolutionMins).toBeLessThan(93);
  });

  it("resolving an uncategorised ticket works and records no category stats", async () => {
    const user = await makeUser("USER");
    const agent = await makeUser("AGENT");
    const t = await makeTicket(user.id, { assignedToId: agent.id, status: "IN_PROGRESS" });
    loginAs(agent);
    expect((await patch(t.id, { status: "RESOLVED", resolutionNote: "ok" })).status).toBe(200);
    expect(await prisma.agentCategoryStat.count()).toBe(0);
  });

  it("an agent cannot resolve someone else's ticket", async () => {
    const user = await makeUser("USER");
    const owner = await makeUser("AGENT");
    const other = await makeUser("AGENT");
    const t = await makeTicket(user.id, { assignedToId: owner.id });
    loginAs(other);
    expect((await patch(t.id, { status: "RESOLVED" })).status).toBe(403);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("OPEN");
  });
});

describe("PATCH: user and admin", () => {
  it("a user can close then reopen their own ticket but not mark it resolved", async () => {
    const user = await makeUser("USER");
    const t = await makeTicket(user.id);
    loginAs(user);
    expect((await patch(t.id, { status: "CLOSED" })).status).toBe(200);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).closedAt).toBeInstanceOf(Date);
    expect((await patch(t.id, { status: "REOPENED" })).status).toBe(200);
    expect((await patch(t.id, { status: "RESOLVED" })).status).toBe(403);
  });

  it("another user cannot close it", async () => {
    const owner = await makeUser("USER");
    const stranger = await makeUser("USER");
    const t = await makeTicket(owner.id);
    loginAs(stranger);
    expect((await patch(t.id, { status: "CLOSED" })).status).toBe(403);
  });

  it("an admin override away from the AI's pick is logged as an override with the reason", async () => {
    const user = await makeUser("USER");
    const aiPick = await makeUser("AGENT");
    const chosen = await makeUser("AGENT");
    const admin = await makeUser("ADMIN");
    const t = await makeTicket(user.id, { assignedToId: aiPick.id, aiSuggestedAgentId: aiPick.id });
    loginAs(admin);

    const res = await patch(t.id, { assignedToId: chosen.id, overrideReason: "aiPick is on leave" });
    expect(res.status).toBe(200);

    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).assignedToId).toBe(chosen.id);
    expect(await prisma.assignmentLog.findFirstOrThrow()).toMatchObject({
      ticketId: t.id, aiSuggestedAgentId: aiPick.id, finalAgentId: chosen.id,
      wasOverridden: true, overriddenById: admin.id, reason: "aiPick is on leave",
    });
  });

  it("an invalid status is rejected with 400 and nothing changes", async () => {
    const user = await makeUser("USER");
    const admin = await makeUser("ADMIN");
    const t = await makeTicket(user.id);
    loginAs(admin);
    expect((await patch(t.id, { status: "DONE" })).status).toBe(400);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("OPEN");
  });

  it("404 for an unknown ticket, and broadcasts ticket:updated on success", async () => {
    const user = await makeUser("USER");
    const admin = await makeUser("ADMIN");
    const t = await makeTicket(user.id);
    loginAs(admin);
    expect((await patch("missing", { status: "CLOSED" })).status).toBe(404);
    await patch(t.id, { priority: "CRITICAL" });
    expect(emitTicketEvent).toHaveBeenCalledWith("ticket:updated", expect.objectContaining({ ticketId: t.id }));
  });
});

describe("comments", () => {
  it("forces a user's comment to be public even if they ask for internal", async () => {
    const user = await makeUser("USER");
    const t = await makeTicket(user.id);
    loginAs(user);
    expect((await comment(t.id, { body: "any update?", isInternal: true })).status).toBe(201);
    expect((await prisma.comment.findFirstOrThrow()).isInternal).toBe(false);
  });

  it("lets an agent post an internal note", async () => {
    const user = await makeUser("USER");
    const agent = await makeUser("AGENT");
    const t = await makeTicket(user.id, { assignedToId: agent.id });
    loginAs(agent);
    await comment(t.id, { body: "customer seems confused", isInternal: true });
    expect((await prisma.comment.findFirstOrThrow()).isInternal).toBe(true);
  });

  it("sets firstResponseAt on the first reply from someone other than the requester, once", async () => {
    const user = await makeUser("USER");
    const agent = await makeUser("AGENT");
    const t = await makeTicket(user.id, { assignedToId: agent.id });

    loginAs(user);
    await comment(t.id, { body: "hello?" });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).firstResponseAt).toBeNull();

    loginAs(agent);
    await comment(t.id, { body: "on it" });
    const first = (await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).firstResponseAt;
    expect(first).toBeInstanceOf(Date);

    await comment(t.id, { body: "another reply" });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).firstResponseAt).toEqual(first);
  });

  it("rejects strangers, unassigned agents and empty bodies", async () => {
    const owner = await makeUser("USER");
    const stranger = await makeUser("USER");
    const agent = await makeUser("AGENT");
    const t = await makeTicket(owner.id);
    loginAs(stranger);
    expect((await comment(t.id, { body: "hi" })).status).toBe(403);
    loginAs(agent);
    expect((await comment(t.id, { body: "hi" })).status).toBe(403);
    loginAs(owner);
    expect((await comment(t.id, { body: "" })).status).toBe(400);
    expect(await prisma.comment.count()).toBe(0);
  });
});

describe("ratings", () => {
  it("only allowed once the ticket is resolved or closed", async () => {
    const user = await makeUser("USER");
    const open = await makeTicket(user.id);
    loginAs(user);
    expect((await rate(open.id, { score: 5 })).status).toBe(400);
  });

  it("stores one rating per ticket and updates it on resubmission", async () => {
    const user = await makeUser("USER");
    const t = await makeTicket(user.id, { status: "RESOLVED" });
    loginAs(user);
    expect((await rate(t.id, { score: 2, feedback: "meh" })).status).toBe(201);
    expect((await rate(t.id, { score: 5, feedback: "great" })).status).toBe(201);
    const rows = await prisma.rating.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ score: 5, feedback: "great", userId: user.id });
  });

  it("rejects out-of-range scores, other users, and non-customers", async () => {
    const user = await makeUser("USER");
    const stranger = await makeUser("USER");
    const agent = await makeUser("AGENT");
    const t = await makeTicket(user.id, { status: "CLOSED" });
    loginAs(user);
    expect((await rate(t.id, { score: 6 })).status).toBe(400);
    loginAs(stranger);
    expect((await rate(t.id, { score: 4 })).status).toBe(403);
    loginAs(agent);
    expect((await rate(t.id, { score: 4 })).status).toBe(403);
    expect(await prisma.rating.count()).toBe(0);
  });
});
