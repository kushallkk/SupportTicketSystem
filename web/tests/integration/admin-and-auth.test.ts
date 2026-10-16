import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { POST as signup } from "@/app/api/auth/signup/route";
import { GET as analytics } from "@/app/api/analytics/overview/route";
import { GET as agents } from "@/app/api/agents/route";
import { prisma } from "@/lib/prisma";
import { hoursAgo, jsonRequest, loginAs, logout, makeCategory, makeTicket, makeUser } from "./helpers";

const register = (b: unknown) => signup(jsonRequest("POST", b));
const good = { name: "New Person", email: "new@example.com", password: "password123" };

describe("POST /api/auth/signup", () => {
  it("creates a USER with a bcrypt-hashed password", async () => {
    expect((await register(good)).status).toBe(201);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: good.email } });
    expect(u.role).toBe("USER");
    expect(u.passwordHash).not.toBe(good.password);
    expect(await bcrypt.compare(good.password, u.passwordHash)).toBe(true);
  });

  it("creates an AGENT together with its agent profile", async () => {
    await register({ ...good, role: "AGENT" });
    const u = await prisma.user.findUniqueOrThrow({ where: { email: good.email }, include: { agentProfile: true } });
    expect(u.role).toBe("AGENT");
    expect(u.agentProfile).not.toBeNull();
  });

  it("refuses to create an ADMIN", async () => {
    expect((await register({ ...good, role: "ADMIN" })).status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it("409 for a duplicate email, 400 for bad input", async () => {
    await register(good);
    expect((await register(good)).status).toBe(409);
    expect((await register({ ...good, email: "x" })).status).toBe(400);
    expect((await register({ ...good, email: "b@b.co", password: "short" })).status).toBe(400);
  });
});

describe("admin-only endpoints", () => {
  it.each(["USER", "AGENT"] as const)("analytics and agents are 403 for %s, 401 when logged out", async (role) => {
    loginAs(await makeUser(role));
    expect((await analytics()).status).toBe(403);
    expect((await agents()).status).toBe(403);
    logout();
    expect((await analytics()).status).toBe(401);
    expect((await agents()).status).toBe(401);
  });

  it("GET /api/agents lists agents with computed open/resolved counts", async () => {
    const user = await makeUser("USER");
    const a = await makeUser("AGENT", "agent-a");
    await makeUser("AGENT", "agent-b");
    await makeTicket(user.id, { assignedToId: a.id, status: "OPEN" });
    await makeTicket(user.id, { assignedToId: a.id, status: "IN_PROGRESS" });
    await makeTicket(user.id, { assignedToId: a.id, status: "CLOSED" });
    loginAs(await makeUser("ADMIN"));

    const list = (await (await agents()).json()) as { name: string; openCount: number; resolvedCount: number; totalCount: number }[];
    expect(list.map((x) => x.name)).toEqual(["agent-a", "agent-b"]);
    expect(list[0]).toMatchObject({ openCount: 2, resolvedCount: 1, totalCount: 3 });
    expect(list[1]).toMatchObject({ openCount: 0, resolvedCount: 0 });
  });
});

describe("GET /api/analytics/overview", () => {
  it("computes SLA compliance, resolution time, category breakdown and AI accuracy from real data", async () => {
    const user = await makeUser("USER");
    const agent = await makeUser("AGENT");
    const billing = await makeCategory("billing", "Billing");

    // HIGH has a 24h SLA: resolved in 2h -> met. CRITICAL has 4h: resolved in 10h -> missed.
    await makeTicket(user.id, {
      priority: "HIGH", categoryId: billing.id, assignedToId: agent.id, status: "RESOLVED",
      createdAt: hoursAgo(5), resolvedAt: hoursAgo(3),
    });
    const t2 = await makeTicket(user.id, {
      priority: "CRITICAL", assignedToId: agent.id, status: "RESOLVED",
      createdAt: hoursAgo(20), resolvedAt: hoursAgo(10),
    });
    await makeTicket(user.id, { status: "OPEN" });

    // AI suggested an agent 3 times; the admin overrode one of them.
    for (const wasOverridden of [false, false, true]) {
      await prisma.assignmentLog.create({
        data: { ticketId: t2.id, aiSuggestedAgentId: agent.id, finalAgentId: agent.id, wasOverridden },
      });
    }
    loginAs(await makeUser("ADMIN"));

    const res = await analytics();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.totalTickets).toBe(3);
    expect(data.slaCompliance).toBe(50);
    expect(data.avgResolutionHours).toBe(6); // (2h + 10h) / 2
    expect(data.modelAccuracy).toBe(66.7);
    expect(data.statusCounts).toMatchObject({ OPEN: 1, RESOLVED: 2, CLOSED: 0 });
    expect(data.categoryBreakdown).toEqual(
      expect.arrayContaining([{ name: "Billing", count: 1 }, { name: "Uncategorized", count: 2 }])
    );
    expect(data.agentWorkload).toHaveLength(1);
    expect(data.agentWorkload[0]).toMatchObject({ openCount: 0, resolvedCount: 2 });
    expect(data.ticketsPerDay).toHaveLength(14);
    expect(data.ticketsPerDay.reduce((s: number, d: { count: number }) => s + d.count, 0)).toBe(3);
  });

  it("is sensible on an empty system (no division by zero)", async () => {
    loginAs(await makeUser("ADMIN"));
    const data = await (await analytics()).json();
    expect(data).toMatchObject({
      totalTickets: 0, avgResolutionHours: 0, slaCompliance: 100, modelAccuracy: null,
    });
  });
});
