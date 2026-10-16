import { expect, test } from "@playwright/test";
import { AGENT_A, AGENT_B, PASSWORD, db, resetAndSeed } from "./db";
import { closeSessions, logIn, newSession, raiseTicket, setStubDuplicates, signUp } from "./helpers";

test.afterEach(closeSessions);

test.beforeEach(async () => {
  await resetAndSeed();
  await setStubDuplicates([]);
});

test("raise -> AI routes it -> agent resolves -> customer rates and it closes", async ({ browser }) => {
  // Customer raises a ticket (the ML stub classifies it as account/HIGH).
  const customer = await newSession(browser);
  await signUp(customer, "Priya Sharma", "priya@test.dev", PASSWORD);
  const ticketId = await raiseTicket(
    customer,
    "Cannot reset my password",
    "The reset email never arrives, even after checking my spam folder."
  );

  // They can see the AI output and who is handling it.
  await expect(customer.getByText("AI classification")).toBeVisible();
  await expect(customer.getByText("account", { exact: true })).toBeVisible();
  await expect(customer.getByText(/Assigned to Agent (Alpha|Beta)/)).toBeVisible();
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { assignedTo: true } });
  expect(ticket).toMatchObject({ priority: "HIGH", status: "OPEN" });
  const assignee = ticket.assignedTo!;
  expect([AGENT_A.email, AGENT_B.email]).toContain(assignee.email);
  expect(await db.assignmentLog.count({ where: { ticketId, wasOverridden: false } })).toBe(1);

  // Only the assigned agent has it in their queue, and they work it to resolution.
  const agent = await newSession(browser);
  await logIn(agent, assignee.email, PASSWORD);
  await expect(agent).toHaveURL(/\/agent$/);
  await agent.getByRole("link", { name: /Cannot reset my password/ }).click();
  await agent.getByRole("button", { name: "Start working on this" }).click();
  await agent.getByLabel("Resolution note").fill("Unlocked the account and re-sent the reset email.");
  await agent.getByRole("button", { name: "Mark resolved" }).click();
  await expect(agent.getByText("Unlocked the account and re-sent the reset email.")).toBeVisible();

  // The customer's open tab updates and they close the loop with a rating.
  await customer.reload();
  await expect(customer.getByText("How did we do?")).toBeVisible();
  await customer.getByRole("button", { name: "5 stars" }).click();
  await customer.getByRole("button", { name: "Submit & close ticket" }).click();
  await expect(customer.getByText("Your feedback")).toBeVisible();

  const done = await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { ratings: true } });
  expect(done.status).toBe("CLOSED");
  expect(done.ratings[0].score).toBe(5);
  expect(done.resolutionNote).toContain("re-sent the reset email");
});

test("the other agent never sees a ticket that was routed elsewhere", async ({ browser }) => {
  const customer = await newSession(browser);
  await signUp(customer, "Priya Sharma", "priya@test.dev", PASSWORD);
  const ticketId = await raiseTicket(customer, "Cannot reset my password", "Reset email never arrives for me.");
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { assignedTo: true } });
  const otherEmail = ticket.assignedTo!.email === AGENT_A.email ? AGENT_B.email : AGENT_A.email;

  const other = await newSession(browser);
  await logIn(other, otherEmail, PASSWORD);
  await expect(other.getByText("Nothing routed to you right now.")).toBeVisible();
  await other.goto(`/agent/${ticketId}`);
  await expect(other.getByText("Ticket not found.")).toBeVisible();
});

test("load balancing: the next ticket goes to the agent with fewer open tickets", async ({ browser }) => {
  const customer = await newSession(browser);
  await signUp(customer, "Priya Sharma", "priya@test.dev", PASSWORD);

  const first = await raiseTicket(customer, "Cannot reset my password", "Reset email never arrives for me.");
  const second = await raiseTicket(customer, "Password reset link not working", "The password reset link just errors out.");

  const [a, b] = await Promise.all(
    [first, second].map((id) => db.ticket.findUniqueOrThrow({ where: { id } }))
  );
  expect(a.assignedToId).not.toBeNull();
  expect(b.assignedToId).not.toBeNull();
  // With one open ticket each time, the stub router (least-open-tickets) must alternate agents.
  expect(a.assignedToId).not.toBe(b.assignedToId);
});

test("duplicate detection: a similar ticket shows the old fix and can be self-resolved", async ({ browser }) => {
  const customer = await newSession(browser);
  await signUp(customer, "Priya Sharma", "priya@test.dev", PASSWORD);
  const owner = await db.user.findUniqueOrThrow({ where: { email: "priya@test.dev" } });

  const old = await db.ticket.create({
    data: {
      title: "Password reset email not arriving",
      description: "Never get the reset email.",
      raisedById: owner.id,
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolutionNote: "Whitelisted the sender and re-issued the reset link.",
    },
  });
  await setStubDuplicates([{ ticketId: old.id, similarity: 0.97 }]);

  await raiseTicket(customer, "Can't reset my password at all", "The password reset email never shows up.");

  await expect(customer.getByText("Looks similar to an existing ticket")).toBeVisible();
  await expect(customer.getByText("97% match")).toBeVisible();
  await expect(customer.getByText("Whitelisted the sender and re-issued the reset link.")).toBeVisible();

  await customer.getByRole("button", { name: "Mark my ticket resolved using this fix" }).click();
  await expect(customer.getByText("Closed", { exact: true })).toBeVisible();
  await expect(customer.getByRole("button", { name: "Mark my ticket resolved using this fix" })).toBeHidden();
});

test("no duplicate banner when nothing is similar", async ({ browser }) => {
  const customer = await newSession(browser);
  await signUp(customer, "Priya Sharma", "priya@test.dev", PASSWORD);
  await raiseTicket(customer, "Cannot reset my password", "Reset email never arrives for me.");
  await expect(customer.getByText("AI classification")).toBeVisible();
  await expect(customer.getByText("Looks similar to an existing ticket")).toHaveCount(0);
});
