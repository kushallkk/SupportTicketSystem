import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const BASE_URL = "http://localhost:3100";
const ML_STUB = "http://localhost:8001";

/** A fresh browser context = its own cookie jar, so several roles can be logged in side by side. */
const openContexts: BrowserContext[] = [];

export async function newSession(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  openContexts.push(context);
  return context.newPage();
}

/** Call from afterEach: leftover tabs keep polling the API while the next test resets the database. */
export async function closeSessions() {
  await Promise.all(openContexts.splice(0).map((c) => c.close().catch(() => {})));
}

export async function signUp(page: Page, name: string, email: string, password: string, role?: "AGENT") {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  if (role === "AGENT") {
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Support agent" }).click();
  }
  await page.getByRole("button", { name: "Create account" }).click();
  // Sign-up creates the account, then signs in, then redirects. Navigating away before that
  // finishes aborts the sign-in and leaves the session cookie unset.
  await expect(page).not.toHaveURL(/\/signup/, { timeout: 60_000 });
}

export async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function raiseTicket(page: Page, title: string, description: string): Promise<string> {
  await page.goto("/dashboard/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill(description);
  await page.getByRole("button", { name: "Submit ticket" }).click();
  // "/dashboard/new" also looks like /dashboard/<id>, so exclude it explicitly.
  await page.waitForURL(/\/dashboard\/(?!new$)[^/]+$/, { timeout: 60_000 });
  return page.url().split("/").pop()!;
}

/** Tell the ML stub which duplicate matches /duplicates should return (empty = none). */
export async function setStubDuplicates(matches: { ticketId: string; similarity: number }[]) {
  const res = await fetch(`${ML_STUB}/__config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matches }),
  });
  if (!res.ok) throw new Error("ML stub rejected config");
}

/**
 * Opens a ticket from a list page. At desktop widths a click only selects the row and shows it in the side
 * panel, so continue to the full page from there; on narrow screens the click navigates directly.
 */
export async function openTicket(page: Page, name: RegExp | string) {
  const row = page.getByRole("link", { name }).first();
  await row.click();
  // The selected row is marked aria-current; only then is the panel guaranteed to show *this* ticket.
  const selected = await expect(row).toHaveAttribute("aria-current", "true", { timeout: 5_000 }).then(
    () => true,
    () => false
  );
  if (selected) await page.locator("a", { hasText: "Open full ticket" }).click();
}
