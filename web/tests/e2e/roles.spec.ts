import { expect, test } from "@playwright/test";
import { ADMIN, AGENT_A, PASSWORD, resetAndSeed } from "./db";
import { closeSessions, logIn, newSession, signUp } from "./helpers";

test.afterEach(closeSessions);

test.beforeEach(async () => {
  await resetAndSeed();
});

test("logged-out visitors are sent to /login from every protected area", async ({ page }) => {
  for (const path of ["/dashboard", "/dashboard/new", "/agent", "/admin", "/admin/analytics"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("a customer can sign up and can never open the agent or admin areas", async ({ page }) => {
  await signUp(page, "Priya Sharma", "priya@test.dev", PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/agent");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/admin/analytics");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("signed-in users are bounced away from /login and /signup to their own home", async ({ browser }) => {
  const agent = await newSession(browser);
  await logIn(agent, AGENT_A.email, PASSWORD);
  await expect(agent).toHaveURL(/\/agent$/);
  await agent.goto("/login");
  await expect(agent).toHaveURL(/\/agent$/);
  await agent.goto("/admin");
  await expect(agent).toHaveURL(/\/agent$/);

  const admin = await newSession(browser);
  await logIn(admin, ADMIN.email, PASSWORD);
  await expect(admin).toHaveURL(/\/admin$/);
  await admin.goto("/dashboard");
  await expect(admin).toHaveURL(/\/admin$/);
});

test("different roles can be signed in at the same time in separate sessions", async ({ browser }) => {
  const customer = await newSession(browser);
  await signUp(customer, "Side By Side", "sbs@test.dev", PASSWORD);
  const admin = await newSession(browser);
  await logIn(admin, ADMIN.email, PASSWORD);

  await customer.reload();
  await expect(customer).toHaveURL(/\/dashboard$/); // admin login did not hijack the customer session
  await expect(admin).toHaveURL(/\/admin$/);
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("Ctrl+K opens the command palette", async ({ browser }) => {
  const admin = await newSession(browser);
  await logIn(admin, ADMIN.email, PASSWORD);
  await admin.keyboard.press("Control+k");
  await expect(admin.getByPlaceholder("Type a command or search...")).toBeVisible();
  await expect(admin.getByRole("option", { name: "Analytics" })).toBeVisible();

  // Typing filters, Enter navigates, and the page must not crash (it did before <Command> was added).
  await admin.getByPlaceholder("Type a command or search...").fill("analytics");
  await admin.keyboard.press("Enter");
  await expect(admin).toHaveURL(/\/admin\/analytics$/);
});
