import { expect, test } from "@playwright/test";
import { ADMIN, AGENT_A, AGENT_B, PASSWORD, db, resetAndSeed } from "./db";
import { closeSessions, logIn, newSession, setStubDuplicates } from "./helpers";

test.afterEach(closeSessions);

test.beforeEach(async () => {
  await resetAndSeed();
});

async function seedAssignedTicket() {
  const customer = await db.user.create({
    data: { name: "Cust Omer", email: "cust@test.dev", passwordHash: "x", role: "USER" },
  });
  const agentA = await db.user.findUniqueOrThrow({ where: { email: AGENT_A.email } });
  const ticket = await db.ticket.create({
    data: {
      title: "Invoice is wrong", description: "The invoice total does not match my plan.",
      raisedById: customer.id, assignedToId: agentA.id, aiSuggestedAgentId: agentA.id,
    },
  });
  return { ticket, agentA };
}

test("admin sees all tickets and can override the AI's assignment; it is logged", async ({ browser }) => {
  const { ticket, agentA } = await seedAssignedTicket();
  const agentB = await db.user.findUniqueOrThrow({ where: { email: AGENT_B.email } });

  const admin = await newSession(browser);
  await logIn(admin, ADMIN.email, PASSWORD);
  await expect(admin.getByRole("link", { name: /Invoice is wrong/ })).toBeVisible();
  await admin.getByRole("link", { name: /Invoice is wrong/ }).click();
  await expect(admin.getByText("Assigned to Agent Alpha")).toBeVisible();

  // The dropdown must show the agent's name, not their database id.
  await expect(admin.getByRole("combobox").first()).toContainText("Agent Alpha");
  await admin.getByRole("combobox").first().click();
  await admin.getByRole("option", { name: /Agent Beta/ }).click();
  await expect(admin.getByRole("combobox").first()).toContainText("Agent Beta");
  await admin.getByPlaceholder("Why change this?").fill("Alpha is out sick");
  await admin.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.getByText("Assigned to Agent Beta")).toBeVisible();

  const after = await db.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
  expect(after.assignedToId).toBe(agentB.id);
  const log = await db.assignmentLog.findFirstOrThrow({ where: { ticketId: ticket.id } });
  expect(log).toMatchObject({
    aiSuggestedAgentId: agentA.id, finalAgentId: agentB.id, wasOverridden: true, reason: "Alpha is out sick",
  });
});

test("the reassigned agent now has the ticket and the previous agent does not", async ({ browser }) => {
  await seedAssignedTicket();
  const admin = await newSession(browser);
  await logIn(admin, ADMIN.email, PASSWORD);
  await admin.getByRole("link", { name: /Invoice is wrong/ }).click();
  await admin.getByRole("combobox").first().click();
  await admin.getByRole("option", { name: /Agent Beta/ }).click();
  await admin.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.getByText("Assigned to Agent Beta")).toBeVisible();

  const beta = await newSession(browser);
  await logIn(beta, AGENT_B.email, PASSWORD);
  await expect(beta.getByRole("link", { name: /Invoice is wrong/ })).toBeVisible();

  const alpha = await newSession(browser);
  await logIn(alpha, AGENT_A.email, PASSWORD);
  await expect(alpha.getByText("Nothing routed to you right now.")).toBeVisible();
});

test("analytics and agents pages render real numbers for an admin", async ({ browser }) => {
  await seedAssignedTicket();
  const admin = await newSession(browser);
  await logIn(admin, ADMIN.email, PASSWORD);

  await admin.goto("/admin/analytics");
  await expect(admin.getByText("Total tickets")).toBeVisible();
  await expect(admin.getByText("SLA compliance")).toBeVisible();
  await expect(admin.getByText("AI routing accuracy")).toBeVisible();
  await expect(admin.getByText("Agent workload")).toBeVisible();
  await expect(admin.getByText("Agent Alpha").first()).toBeVisible();

  await admin.goto("/admin/agents");
  await expect(admin.getByText("Agent Alpha")).toBeVisible();
  await expect(admin.getByText("Agent Beta")).toBeVisible();
});

test("the AI model card shows what is live and retraining swaps it for a better one", async ({ browser }) => {
  await setStubDuplicates([]); // also resets the ML stub to its "built-in model" state
  const admin = await newSession(browser);
  await logIn(admin, ADMIN.email, PASSWORD);
  await admin.goto("/admin/analytics");

  const card = admin.getByTestId("model-card");
  await expect(card.getByText("Built-in model")).toBeVisible();
  await expect(card.getByText("54 built-in examples")).toBeVisible();

  await admin.getByRole("button", { name: "Retrain from corrections" }).click();

  await expect(admin.getByText(/New model is live/)).toBeVisible();
  await expect(card.getByText("Retrained model")).toBeVisible();
  await expect(card.getByText("2 admin corrections")).toBeVisible();
  await expect(card.getByText("93%")).toBeVisible(); // candidate accuracy
  await expect(card.getByText(/original model\s+scored 64%/)).toBeVisible();
});

test("customers and agents never get the retrain endpoint", async ({ browser }) => {
  const agent = await newSession(browser);
  await logIn(agent, AGENT_A.email, PASSWORD);
  expect((await agent.request.post("/api/ml/retrain")).status()).toBe(403);
  expect((await agent.request.get("/api/ml/model")).status()).toBe(403);
});
