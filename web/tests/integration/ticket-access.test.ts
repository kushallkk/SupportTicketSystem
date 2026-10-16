import { describe, expect, it } from "vitest";
import { GET as listTickets } from "@/app/api/tickets/route";
import { GET as getTicket } from "@/app/api/tickets/[id]/route";
import { prisma } from "@/lib/prisma";
import { idParams, jsonRequest, loginAs, logout, makeTicket, makeUser } from "./helpers";

const list = (query = "") => listTickets(jsonRequest("GET", undefined, `http://localhost/api/tickets${query}`));
const ids = async (res: Response) => ((await res.json()) as { id: string }[]).map((t) => t.id).sort();

async function world() {
  const alice = await makeUser("USER", "alice");
  const bob = await makeUser("USER", "bob");
  const agent1 = await makeUser("AGENT", "agent-one");
  const agent2 = await makeUser("AGENT", "agent-two");
  const admin = await makeUser("ADMIN");
  const t1 = await makeTicket(alice.id, { title: "Alice printer broken", assignedToId: agent1.id });
  const t2 = await makeTicket(bob.id, { title: "Bob billing question", assignedToId: agent2.id, status: "RESOLVED" });
  const t3 = await makeTicket(alice.id, { title: "Alice unassigned thing" });
  return { alice, bob, agent1, agent2, admin, t1, t2, t3 };
}

describe("GET /api/tickets: each role sees only what it should", () => {
  it("401 when logged out", async () => {
    logout();
    expect((await list()).status).toBe(401);
  });

  it("a user sees only their own tickets", async () => {
    const w = await world();
    loginAs(w.alice);
    expect(await ids(await list())).toEqual([w.t1.id, w.t3.id].sort());
  });

  it("an agent sees only tickets assigned to them (not unassigned ones)", async () => {
    const w = await world();
    loginAs(w.agent1);
    expect(await ids(await list())).toEqual([w.t1.id]);
  });

  it("an admin sees every ticket", async () => {
    const w = await world();
    loginAs(w.admin);
    expect(await ids(await list())).toEqual([w.t1.id, w.t2.id, w.t3.id].sort());
  });

  it("filters by status and by case-insensitive search, still within the caller's scope", async () => {
    const w = await world();
    loginAs(w.admin);
    expect(await ids(await list("?status=RESOLVED"))).toEqual([w.t2.id]);
    expect(await ids(await list("?q=PRINTER"))).toEqual([w.t1.id]);
    loginAs(w.alice);
    expect(await ids(await list("?q=billing"))).toEqual([]); // Bob's ticket stays invisible
  });

  it("includes requester, assignee and comment count", async () => {
    const w = await world();
    await prisma.comment.create({ data: { ticketId: w.t1.id, authorId: w.agent1.id, body: "hi" } });
    loginAs(w.admin);
    const found = ((await (await list("?q=printer")).json()) as any[])[0];
    expect(found.raisedBy.name).toBe("alice");
    expect(found.assignedTo.name).toBe("agent-one");
    expect(found._count.comments).toBe(1);
  });
});

describe("GET /api/tickets/[id]", () => {
  it("404 for a ticket that doesn't exist", async () => {
    const w = await world();
    loginAs(w.admin);
    expect((await getTicket(jsonRequest("GET"), idParams("nope"))).status).toBe(404);
  });

  it("a user cannot read someone else's ticket", async () => {
    const w = await world();
    loginAs(w.bob);
    expect((await getTicket(jsonRequest("GET"), idParams(w.t1.id))).status).toBe(403);
  });

  it("an agent cannot read a ticket assigned to another agent, or an unassigned one", async () => {
    const w = await world();
    loginAs(w.agent1);
    expect((await getTicket(jsonRequest("GET"), idParams(w.t2.id))).status).toBe(403);
    expect((await getTicket(jsonRequest("GET"), idParams(w.t3.id))).status).toBe(403);
  });

  it("owner, assigned agent and admin can all read it", async () => {
    const w = await world();
    for (const u of [w.alice, w.agent1, w.admin]) {
      loginAs(u);
      expect((await getTicket(jsonRequest("GET"), idParams(w.t1.id))).status).toBe(200);
    }
  });

  it("hides internal notes from the requester but shows them to agent and admin", async () => {
    const w = await world();
    await prisma.comment.createMany({
      data: [
        { ticketId: w.t1.id, authorId: w.agent1.id, body: "public reply", isInternal: false },
        { ticketId: w.t1.id, authorId: w.agent1.id, body: "SECRET internal note", isInternal: true },
      ],
    });
    const bodies = async (u: typeof w.alice) => {
      loginAs(u);
      const t = (await (await getTicket(jsonRequest("GET"), idParams(w.t1.id))).json()) as { comments: { body: string }[] };
      return t.comments.map((c) => c.body);
    };
    expect(await bodies(w.alice)).toEqual(["public reply"]);
    expect(await bodies(w.agent1)).toContain("SECRET internal note");
    expect(await bodies(w.admin)).toContain("SECRET internal note");
  });
});
