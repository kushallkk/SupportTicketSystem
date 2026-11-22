import { describe, expect, it } from "vitest";
import { GET as listTickets } from "@/app/api/tickets/route";
import { GET as getTicket } from "@/app/api/tickets/[id]/route";
import { formatTicketId } from "@/lib/ticket-display";
import { idParams, jsonRequest, loginAs, makeTicket, makeUser } from "./helpers";

const list = (query = "") => listTickets(jsonRequest("GET", undefined, `http://localhost/api/tickets${query}`));

describe("ticket numbers (TKT-0001, TKT-0002, ...)", () => {
  it("are handed out in sequence and are unique", async () => {
    const customer = await makeUser("USER");
    const a = await makeTicket(customer.id, { title: "First ticket here" });
    const b = await makeTicket(customer.id, { title: "Second ticket here" });
    const c = await makeTicket(customer.id, { title: "Third ticket here" });

    expect(b.number).toBe(a.number + 1);
    expect(c.number).toBe(b.number + 1);
    expect(new Set([a.number, b.number, c.number]).size).toBe(3);
  });

  it("are included in the list and detail responses", async () => {
    const customer = await makeUser("USER");
    const ticket = await makeTicket(customer.id);
    loginAs(customer);

    const rows = await (await list()).json();
    expect(rows[0].number).toBe(ticket.number);

    const detail = await (await getTicket(jsonRequest("GET"), idParams(ticket.id))).json();
    expect(detail.number).toBe(ticket.number);
  });

  it("can be searched by quoting the ID in any common form", async () => {
    const customer = await makeUser("USER");
    const wanted = await makeTicket(customer.id, { title: "Printer on fire", description: "Smoke is coming from the printer." });
    await makeTicket(customer.id, { title: "Wifi is slow", description: "The wifi drops every few minutes." });
    loginAs(customer);

    for (const q of [formatTicketId(wanted.number), `tkt${wanted.number}`, `#${wanted.number}`, String(wanted.number)]) {
      const rows = await (await list(`?q=${encodeURIComponent(q)}`)).json();
      expect(rows.map((r: { id: string }) => r.id), q).toContain(wanted.id);
    }
  });

  it("do not let one customer find another's ticket by its number", async () => {
    const owner = await makeUser("USER");
    const stranger = await makeUser("USER");
    const ticket = await makeTicket(owner.id);

    loginAs(stranger);
    const rows = await (await list(`?q=${formatTicketId(ticket.number)}`)).json();
    expect(rows).toEqual([]);
  });
});
