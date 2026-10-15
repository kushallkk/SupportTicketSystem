import { describe, expect, it } from "vitest";
import { buildTicketUpdate } from "./ticket-update";

const NOW = new Date("2026-01-01T00:00:00Z");
type TestTicket = { raisedById: string; assignedToId: string | null; aiSuggestedAgentId: string | null };
const ticket: TestTicket = { raisedById: "user-1", assignedToId: "agent-1", aiSuggestedAgentId: "agent-1" };

function run(role: "USER" | "AGENT" | "ADMIN", userId: string, body: unknown, t: TestTicket = ticket) {
  return buildTicketUpdate({ role, userId, ticket: t, body, now: NOW });
}

describe("USER", () => {
  it("can close their own ticket and stamps closedAt", () => {
    const r = run("USER", "user-1", { status: "CLOSED" });
    expect(r).toEqual({ ok: true, data: { status: "CLOSED", closedAt: NOW }, reassignment: null });
  });

  it("can reopen their own ticket", () => {
    const r = run("USER", "user-1", { status: "REOPENED" });
    expect(r.ok && r.data.status).toBe("REOPENED");
  });

  it("cannot touch someone else's ticket", () => {
    expect(run("USER", "user-2", { status: "CLOSED" })).toMatchObject({ ok: false, status: 403 });
  });

  it.each(["IN_PROGRESS", "RESOLVED", "OPEN"])("cannot set status %s", (status) => {
    expect(run("USER", "user-1", { status })).toMatchObject({ ok: false, status: 403 });
  });

  it("cannot change priority, category, assignee or resolution note", () => {
    const r = run("USER", "user-1", {
      priority: "CRITICAL", categoryId: "c1", assignedToId: "agent-2", resolutionNote: "hacked",
    });
    expect(r).toEqual({ ok: true, data: {}, reassignment: null });
  });
});

describe("AGENT", () => {
  it("can start work on an assigned ticket", () => {
    const r = run("AGENT", "agent-1", { status: "IN_PROGRESS" });
    expect(r.ok && r.data).toEqual({ status: "IN_PROGRESS" });
  });

  it("can resolve with a note and stamps resolvedAt", () => {
    const r = run("AGENT", "agent-1", { status: "RESOLVED", resolutionNote: "Reset the lock" });
    expect(r.ok && r.data).toEqual({ status: "RESOLVED", resolutionNote: "Reset the lock", resolvedAt: NOW });
  });

  it("cannot touch a ticket assigned to another agent", () => {
    expect(run("AGENT", "agent-2", { status: "RESOLVED" })).toMatchObject({ ok: false, status: 403 });
  });

  it("cannot touch an unassigned ticket", () => {
    const r = run("AGENT", "agent-1", { status: "IN_PROGRESS" }, { ...ticket, assignedToId: null });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it.each(["CLOSED", "OPEN", "REOPENED"])("cannot set status %s", (status) => {
    expect(run("AGENT", "agent-1", { status })).toMatchObject({ ok: false, status: 403 });
  });

  it("cannot reassign or change priority", () => {
    const r = run("AGENT", "agent-1", { assignedToId: "agent-2", priority: "LOW" });
    expect(r).toEqual({ ok: true, data: {}, reassignment: null });
  });
});

describe("ADMIN", () => {
  it("can set any status, priority and category", () => {
    const r = run("ADMIN", "admin-1", { status: "CLOSED", priority: "HIGH", categoryId: "c2" });
    expect(r.ok && r.data).toEqual({ status: "CLOSED", priority: "HIGH", categoryId: "c2", closedAt: NOW });
  });

  it("reassigning away from the AI suggestion is logged as an override", () => {
    const r = run("ADMIN", "admin-1", { assignedToId: "agent-2", overrideReason: "agent-1 on leave" });
    expect(r).toMatchObject({
      ok: true,
      data: { assignedToId: "agent-2" },
      reassignment: { finalAgentId: "agent-2", wasOverridden: true, reason: "agent-1 on leave" },
    });
  });

  it("reassigning to the AI-suggested agent is not an override", () => {
    const t = { ...ticket, assignedToId: null };
    const r = run("ADMIN", "admin-1", { assignedToId: "agent-1" }, t);
    expect(r).toMatchObject({ ok: true, reassignment: { wasOverridden: false, reason: null } });
  });

  it("assigning a ticket the AI never suggested anyone for is not an override", () => {
    const t = { raisedById: "user-1", assignedToId: null, aiSuggestedAgentId: null };
    const r = run("ADMIN", "admin-1", { assignedToId: "agent-2" }, t);
    expect(r).toMatchObject({ ok: true, reassignment: { wasOverridden: false } });
  });

  it("no reassignment record when the assignee is unchanged", () => {
    const r = run("ADMIN", "admin-1", { assignedToId: "agent-1" });
    expect(r).toEqual({ ok: true, data: {}, reassignment: null });
  });

  it("can unassign a ticket", () => {
    const r = run("ADMIN", "admin-1", { assignedToId: null });
    expect(r).toMatchObject({ ok: true, data: { assignedToId: null }, reassignment: { finalAgentId: null } });
  });
});

describe("input validation", () => {
  it.each([
    [{ status: "DONE" }],
    [{ priority: "URGENT" }],
    [{ assignedToId: 42 }],
    [{ resolutionNote: "x".repeat(5001) }],
  ])("rejects %j with 400 instead of reaching the database", (body) => {
    expect(run("ADMIN", "admin-1", body)).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a non-object body", () => {
    expect(run("ADMIN", "admin-1", null)).toMatchObject({ ok: false, status: 400 });
  });

  it("ignores unknown fields", () => {
    const r = run("ADMIN", "admin-1", { status: "OPEN", isAdmin: true, raisedById: "evil" });
    expect(r.ok && r.data).toEqual({ status: "OPEN" });
  });
});
