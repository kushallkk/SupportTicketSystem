import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { AGENT_A, AGENT_B, PASSWORD, UPLOAD_DIR, db, resetAndSeed } from "./db";
import { closeSessions, logIn, newSession, raiseTicket, setStubDuplicates, signUp } from "./helpers";

test.afterEach(closeSessions);

test.beforeEach(async () => {
  await resetAndSeed();
  await setStubDuplicates([]);
});

// A real, valid 1x1 PNG so the browser can actually decode and display it.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");

const png = { name: "screenshot.png", mimeType: "image/png", buffer: PNG };
const pdf = { name: "invoice.pdf", mimeType: "application/pdf", buffer: PDF };
const txt = { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("steps to reproduce\n1. click\n2. boom") };

async function raiseWithFiles(page: Page, files: Parameters<ReturnType<Page["getByLabel"]>["setInputFiles"]>[0]) {
  await page.goto("/dashboard/new");
  await page.getByLabel("Title").fill("Cannot reset my password");
  await page.getByLabel("Description").fill("The reset email never arrives, even after checking spam.");
  await page.getByLabel("Attach files").setInputFiles(files);
  await page.getByRole("button", { name: "Submit ticket" }).click();
  await page.waitForURL(/\/dashboard\/(?!new$)[^/]+$/, { timeout: 60_000 });
  return page.url().split("/").pop()!;
}

async function storedFileCount() {
  try {
    const entries = await fs.readdir(UPLOAD_DIR, { recursive: true, withFileTypes: true });
    return entries.filter((e) => e.isFile()).length;
  } catch {
    return 0;
  }
}

test("a customer attaches files when raising a ticket; the assigned agent sees and downloads them", async ({ browser }) => {
  const customer = await newSession(browser);
  await signUp(customer, "Priya Sharma", "priya@test.dev", PASSWORD);
  const ticketId = await raiseWithFiles(customer, [png, pdf, txt]);

  // Shown on the ticket: image previewed (really decoded), documents listed with names.
  const list = customer.getByTestId("attachment-list");
  await expect(list.getByRole("img", { name: "screenshot.png" })).toBeVisible();
  await expect
    .poll(() => list.getByRole("img", { name: "screenshot.png" }).evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1);
  await expect(list.getByText("invoice.pdf")).toBeVisible();
  await expect(list.getByText("notes.txt")).toBeVisible();

  const rows = await db.attachment.findMany({ where: { ticketId }, orderBy: { fileName: "asc" } });
  expect(rows.map((r) => r.fileName)).toEqual(["invoice.pdf", "notes.txt", "screenshot.png"]);
  expect(await storedFileCount()).toBe(3);

  // The agent it was routed to can see and download them.
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { assignedTo: true } });
  const agent = await newSession(browser);
  await logIn(agent, ticket.assignedTo!.email, PASSWORD);
  await agent.goto(`/agent/${ticketId}`);
  await expect(agent.getByText("invoice.pdf")).toBeVisible();

  const [download] = await Promise.all([
    agent.waitForEvent("download"),
    agent.getByRole("link", { name: "Download invoice.pdf" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("invoice.pdf");
  expect(await fs.readFile((await download.path())!)).toEqual(PDF);
});

test("disallowed types are stopped in the browser before anything is sent", async ({ browser }) => {
  const customer = await newSession(browser);
  await signUp(customer, "Priya Sharma", "priya@test.dev", PASSWORD);
  await customer.goto("/dashboard/new");

  await customer.getByLabel("Attach files").setInputFiles({
    name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg><script>alert(1)</script></svg>"),
  });
  await expect(customer.getByText(/isn't an allowed file type/)).toBeVisible();
  await expect(customer.getByRole("list", { name: "Files to upload" })).toHaveCount(0);
});

test("a disguised file is caught by the server; the ticket is still created, without it", async ({ browser }) => {
  const customer = await newSession(browser);
  await signUp(customer, "Priya Sharma", "priya@test.dev", PASSWORD);

  const ticketId = await raiseWithFiles(customer, {
    name: "innocent.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html>"),
  });

  await expect(customer.getByText(/doesn't look like a real \.png/)).toBeVisible();
  expect(await db.ticket.count({ where: { id: ticketId } })).toBe(1);
  expect(await db.attachment.count()).toBe(0);
  expect(await storedFileCount()).toBe(0);
});

test("files on an internal note are invisible to the customer; files on public comments are shared", async ({ browser }) => {
  // ~15 sequential round-trips to a remote DB (sign-up, upload, agent login, two comment+upload cycles).
  test.setTimeout(180_000);
  const customer = await newSession(browser);
  await signUp(customer, "Priya Sharma", "priya@test.dev", PASSWORD);
  const ticketId = await raiseWithFiles(customer, [png]);
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { assignedTo: true } });

  const agent = await newSession(browser);
  await logIn(agent, ticket.assignedTo!.email, PASSWORD);
  await agent.goto(`/agent/${ticketId}`);

  // Internal note with a secret file.
  await agent.getByPlaceholder("Add a comment or internal note...").fill("Customer looks like a repeat offender");
  await agent.getByRole("switch").click();
  await agent.getByLabel("Attach files").setInputFiles({ name: "secret-notes.txt", mimeType: "text/plain", buffer: Buffer.from("internal only") });
  await agent.getByRole("button", { name: "Post" }).click();
  // Assert on the POSTED file (inside the attachment list), not the pending-file chip in the composer.
  await expect(agent.getByTestId("attachment-list").getByText("secret-notes.txt")).toBeVisible();

  // Public reply with a shared file.
  await agent.getByPlaceholder("Add a comment or internal note...").fill("Here is the fix guide");
  await agent.getByLabel("Attach files").setInputFiles({ name: "fix-guide.pdf", mimeType: "application/pdf", buffer: PDF });
  await agent.getByRole("button", { name: "Post" }).click();
  await expect(agent.getByTestId("attachment-list").getByText("fix-guide.pdf")).toBeVisible();

  const secret = await db.attachment.findFirstOrThrow({ where: { fileName: "secret-notes.txt" } });
  expect(secret.isInternal).toBe(true);

  await customer.reload();
  await expect(customer.getByText("Here is the fix guide")).toBeVisible();
  await expect(customer.getByText("fix-guide.pdf")).toBeVisible();
  await expect(customer.getByText("secret-notes.txt")).toHaveCount(0);
  await expect(customer.getByText("repeat offender")).toHaveCount(0);

  // And direct URL guessing doesn't leak it either.
  const direct = await customer.request.get(`/api/attachments/${secret.id}`);
  expect(direct.status()).toBe(404);
});

test("the uploader can remove their own file; the bytes are deleted too", async ({ browser }) => {
  const customer = await newSession(browser);
  await signUp(customer, "Priya Sharma", "priya@test.dev", PASSWORD);
  await raiseWithFiles(customer, [pdf]);
  await expect(customer.getByText("invoice.pdf")).toBeVisible();
  expect(await storedFileCount()).toBe(1);

  customer.once("dialog", (dialog) => dialog.accept());
  await customer.getByRole("button", { name: "Remove invoice.pdf" }).click();

  await expect(customer.getByText("invoice.pdf")).toHaveCount(0);
  expect(await db.attachment.count()).toBe(0);
  await expect.poll(storedFileCount).toBe(0);
});

test("strangers and logged-out visitors cannot download a file", async ({ browser }) => {
  const owner = await newSession(browser);
  await signUp(owner, "Priya Sharma", "priya@test.dev", PASSWORD);
  await raiseWithFiles(owner, [png]);
  const att = await db.attachment.findFirstOrThrow();

  const stranger = await newSession(browser);
  await signUp(stranger, "Someone Else", "stranger@test.dev", PASSWORD);
  expect((await stranger.request.get(`/api/attachments/${att.id}`)).status()).toBe(403);

  const anon = await newSession(browser);
  expect((await anon.request.get(`/api/attachments/${att.id}`)).status()).toBe(401);

  // The owner gets the real bytes with the hardened headers.
  const mine = await owner.request.get(`/api/attachments/${att.id}`);
  expect(mine.status()).toBe(200);
  expect(mine.headers()["x-content-type-options"]).toBe("nosniff");
  expect(Buffer.from(await mine.body())).toEqual(PNG);
});

test("the other agent cannot see attachments on a ticket routed elsewhere", async ({ browser }) => {
  const customer = await newSession(browser);
  await signUp(customer, "Priya Sharma", "priya@test.dev", PASSWORD);
  const ticketId = await raiseWithFiles(customer, [png]);
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { assignedTo: true } });
  const otherEmail = ticket.assignedTo!.email === AGENT_A.email ? AGENT_B.email : AGENT_A.email;
  const att = await db.attachment.findFirstOrThrow();

  const other = await newSession(browser);
  await logIn(other, otherEmail, PASSWORD);
  expect((await other.request.get(`/api/attachments/${att.id}`)).status()).toBe(403);
});
