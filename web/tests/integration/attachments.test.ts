import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as upload } from "@/app/api/tickets/[id]/attachments/route";
import { GET as download, DELETE as remove } from "@/app/api/attachments/[id]/route";
import { GET as getTicket } from "@/app/api/tickets/[id]/route";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { MAX_ATTACHMENTS_PER_TICKET, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from "@/lib/attachment-rules";
import { idParams, jsonRequest, loginAs, logout, makeTicket, makeUser, type TestUser } from "./helpers";

afterEach(() => vi.restoreAllMocks());

const enc = (s: string) => new TextEncoder().encode(s);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PDF = enc("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");

const file = (name: string, data: Uint8Array | string) =>
  new File([typeof data === "string" ? enc(data) : (data as BlobPart)], name);

function postFiles(ticketId: string, files: File[], extra: Record<string, string> = {}) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  Object.entries(extra).forEach(([k, v]) => form.append(k, v));
  return upload(new Request("http://localhost/api/upload", { method: "POST", body: form }), idParams(ticketId));
}

async function storedFiles(): Promise<string[]> {
  try {
    const entries = await fs.readdir(process.env.UPLOAD_DIR!, { recursive: true, withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name));
  } catch {
    return [];
  }
}

async function world() {
  const customer = await makeUser("USER", "customer");
  const agent = await makeUser("AGENT", "agent");
  const otherAgent = await makeUser("AGENT", "other-agent");
  const stranger = await makeUser("USER", "stranger");
  const admin = await makeUser("ADMIN");
  const ticket = await makeTicket(customer.id, { assignedToId: agent.id });
  return { customer, agent, otherAgent, stranger, admin, ticket };
}

async function uploaded(w: Awaited<ReturnType<typeof world>>, who: TestUser, name = "shot.png", data: Uint8Array = PNG, extra = {}) {
  loginAs(who);
  const res = await postFiles(w.ticket.id, [file(name, data)], extra);
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }[])[0].id;
}

describe("uploading", () => {
  it("stores the bytes and a row, with a random key that does not contain the filename", async () => {
    const w = await world();
    loginAs(w.customer);
    const res = await postFiles(w.ticket.id, [file("My Screenshot.PNG", PNG), file("report.pdf", PDF)]);

    expect(res.status).toBe(201);
    const rows = await prisma.attachment.findMany({ orderBy: { fileName: "asc" } });
    expect(rows.map((r) => [r.fileName, r.mimeType, r.fileSize, r.uploadedById, r.commentId, r.isInternal])).toEqual([
      ["My Screenshot.PNG", "image/png", PNG.length, w.customer.id, null, false],
      ["report.pdf", "application/pdf", PDF.length, w.customer.id, null, false],
    ]);
    for (const r of rows) {
      expect(r.storageKey).toMatch(new RegExp(`^tickets/${w.ticket.id}/[0-9a-f-]{36}$`));
      expect(r.storageKey.toLowerCase()).not.toContain("screenshot");
      expect(Array.from((await getStorage().get(r.storageKey))!)).toEqual(Array.from(r.fileName.endsWith("pdf") ? PDF : PNG));
    }
  });

  it("neutralises path traversal in the filename; nothing is written outside the upload dir", async () => {
    const w = await world();
    loginAs(w.customer);
    expect((await postFiles(w.ticket.id, [file("../../../evil.png", PNG)])).status).toBe(201);

    expect((await prisma.attachment.findFirstOrThrow()).fileName).toBe("evil.png");
    const files = await storedFiles();
    expect(files).toHaveLength(1);
    expect(files[0].startsWith(path.resolve(process.env.UPLOAD_DIR!))).toBe(true);
  });

  it.each([
    ["an SVG", "logo.svg", "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"],
    ["HTML renamed to .png", "innocent.png", "<html><script>alert(1)</script></html>"],
    ["an executable", "setup.exe", "MZ\u0090\u0000\u0003"],
    ["an empty file", "empty.txt", ""],
  ])("rejects %s and stores nothing", async (_label, name, content) => {
    const w = await world();
    loginAs(w.customer);
    const res = await postFiles(w.ticket.id, [file(name, content)]);
    expect(res.status).toBe(400);
    expect(await prisma.attachment.count()).toBe(0);
    expect(await storedFiles()).toEqual([]);
  });

  it("rejects a file over the size limit", async () => {
    const w = await world();
    loginAs(w.customer);
    const big = new Uint8Array(MAX_FILE_BYTES + 1).fill(65); // 'A'
    const res = await postFiles(w.ticket.id, [file("big.txt", big)]);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/limit/);
  });

  it("is all-or-nothing: one bad file in a batch means none are stored", async () => {
    const w = await world();
    loginAs(w.customer);
    const res = await postFiles(w.ticket.id, [file("good.png", PNG), file("bad.svg", "<svg/>")]);
    expect(res.status).toBe(400);
    expect(await prisma.attachment.count()).toBe(0);
    expect(await storedFiles()).toEqual([]);
  });

  it("enforces per-upload and per-ticket limits and requires at least one file", async () => {
    const w = await world();
    loginAs(w.customer);
    const many = Array.from({ length: MAX_FILES_PER_UPLOAD + 1 }, (_, i) => file(`f${i}.png`, PNG));
    expect((await postFiles(w.ticket.id, many)).status).toBe(400);
    expect((await postFiles(w.ticket.id, [])).status).toBe(400);

    await prisma.attachment.createMany({
      data: Array.from({ length: MAX_ATTACHMENTS_PER_TICKET - 1 }, (_, i) => ({
        ticketId: w.ticket.id, uploadedById: w.customer.id, fileName: `old${i}.png`,
        storageKey: `tickets/${w.ticket.id}/seed-${i}`, fileSize: 1, mimeType: "image/png",
      })),
    });
    expect((await postFiles(w.ticket.id, [file("a.png", PNG), file("b.png", PNG)])).status).toBe(400);
    expect((await postFiles(w.ticket.id, [file("a.png", PNG)])).status).toBe(201);
  });

  it("rejects a non-multipart body", async () => {
    const w = await world();
    loginAs(w.customer);
    const res = await upload(jsonRequest("POST", { files: "nope" }), idParams(w.ticket.id));
    expect(res.status).toBe(400);
  });

  it("cleans up everything if storing fails part-way", async () => {
    const w = await world();
    loginAs(w.customer);
    const storage = getStorage();
    const realPut = storage.put.bind(storage);
    let calls = 0;
    vi.spyOn(storage, "put").mockImplementation(async (key, data) => {
      if (++calls === 2) throw new Error("disk full");
      return realPut(key, data);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await postFiles(w.ticket.id, [file("a.png", PNG), file("b.png", PNG)]);

    expect(res.status).toBe(500);
    expect(await prisma.attachment.count()).toBe(0);
    expect(await storedFiles()).toEqual([]);
  });
});

describe("who may upload", () => {
  it("401 when logged out, 404 for an unknown ticket", async () => {
    const w = await world();
    logout();
    expect((await postFiles(w.ticket.id, [file("a.png", PNG)])).status).toBe(401);
    loginAs(w.customer);
    expect((await postFiles("missing", [file("a.png", PNG)])).status).toBe(404);
  });

  it("strangers and unassigned agents are refused; requester, assigned agent and admin are allowed", async () => {
    const w = await world();
    for (const who of [w.stranger, w.otherAgent]) {
      loginAs(who);
      expect((await postFiles(w.ticket.id, [file("a.png", PNG)])).status).toBe(403);
    }
    for (const who of [w.customer, w.agent, w.admin]) {
      loginAs(who);
      expect((await postFiles(w.ticket.id, [file("a.png", PNG)])).status).toBe(201);
    }
    expect(await prisma.attachment.count()).toBe(3);
  });
});

describe("attaching to comments", () => {
  it("links files to the uploader's own comment", async () => {
    const w = await world();
    const comment = await prisma.comment.create({ data: { ticketId: w.ticket.id, authorId: w.customer.id, body: "see screenshot" } });
    const id = await uploaded(w, w.customer, "shot.png", PNG, { commentId: comment.id });
    expect((await prisma.attachment.findUniqueOrThrow({ where: { id } })).commentId).toBe(comment.id);
  });

  it("refuses someone else's comment, and a comment from a different ticket", async () => {
    const w = await world();
    const agentComment = await prisma.comment.create({ data: { ticketId: w.ticket.id, authorId: w.agent.id, body: "hi" } });
    const otherTicket = await makeTicket(w.customer.id);
    const otherComment = await prisma.comment.create({ data: { ticketId: otherTicket.id, authorId: w.customer.id, body: "x" } });

    loginAs(w.customer);
    expect((await postFiles(w.ticket.id, [file("a.png", PNG)], { commentId: agentComment.id })).status).toBe(403);
    expect((await postFiles(w.ticket.id, [file("a.png", PNG)], { commentId: otherComment.id })).status).toBe(400);
    expect(await prisma.attachment.count()).toBe(0);
  });

  it("files on an internal note are internal: hidden from the requester everywhere, visible to staff", async () => {
    const w = await world();
    const note = await prisma.comment.create({
      data: { ticketId: w.ticket.id, authorId: w.agent.id, body: "internal", isInternal: true },
    });
    const secretId = await uploaded(w, w.agent, "internal.png", PNG, { commentId: note.id });
    const publicId = await uploaded(w, w.agent, "public.png");
    expect((await prisma.attachment.findUniqueOrThrow({ where: { id: secretId } })).isInternal).toBe(true);

    const listed = async (who: TestUser) => {
      loginAs(who);
      const t = (await (await getTicket(jsonRequest("GET"), idParams(w.ticket.id))).json()) as { attachments: { id: string }[] };
      return t.attachments.map((a) => a.id).sort();
    };
    expect(await listed(w.customer)).toEqual([publicId]);
    expect(await listed(w.agent)).toEqual([publicId, secretId].sort());
    expect(await listed(w.admin)).toEqual([publicId, secretId].sort());

    loginAs(w.customer);
    expect((await download(jsonRequest("GET"), idParams(secretId))).status).toBe(404);
    expect((await remove(jsonRequest("DELETE"), idParams(secretId))).status).toBe(404);
    loginAs(w.agent);
    expect((await download(jsonRequest("GET"), idParams(secretId))).status).toBe(200);
  });
});

describe("downloading", () => {
  it("serves the exact bytes with hardened headers; images inline, everything else as a download", async () => {
    const w = await world();
    const pngId = await uploaded(w, w.customer, "shot.png", PNG);
    const pdfId = await uploaded(w, w.customer, "report.pdf", PDF);
    const txtId = await uploaded(w, w.customer, "notes.txt", enc("hello"));

    loginAs(w.agent);
    const png = await download(jsonRequest("GET"), idParams(pngId));
    expect(png.status).toBe(200);
    expect(new Uint8Array(await png.arrayBuffer())).toEqual(PNG);
    expect(png.headers.get("content-type")).toBe("image/png");
    expect(png.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(png.headers.get("x-content-type-options")).toBe("nosniff");
    expect(png.headers.get("content-security-policy")).toContain("sandbox");
    expect(png.headers.get("cache-control")).toContain("no-store");

    for (const id of [pdfId, txtId]) {
      expect((await download(jsonRequest("GET"), idParams(id))).headers.get("content-disposition")).toMatch(/^attachment;/);
    }
    const forced = await download(jsonRequest("GET", undefined, "http://localhost/api/attachments/x?download=1"), idParams(pngId));
    expect(forced.headers.get("content-disposition")).toMatch(/^attachment;/);
  });

  it("cannot be tricked by a hostile filename in the response headers", async () => {
    const w = await world();
    const id = await uploaded(w, w.customer, 'we"ird\r\nX-Evil: 1 ünï.png');
    loginAs(w.customer);
    const res = await download(jsonRequest("GET"), idParams(id));
    const disposition = res.headers.get("content-disposition")!;
    expect(res.headers.get("x-evil")).toBeNull();
    expect(disposition).not.toMatch(/[\r\n]/);
    expect(disposition).toContain("filename*=UTF-8''");
  });

  it("401 logged out, 403 for strangers and unassigned agents, 404 unknown, 404 when the file vanished from storage", async () => {
    const w = await world();
    const id = await uploaded(w, w.customer);

    logout();
    expect((await download(jsonRequest("GET"), idParams(id))).status).toBe(401);
    for (const who of [w.stranger, w.otherAgent]) {
      loginAs(who);
      expect((await download(jsonRequest("GET"), idParams(id))).status).toBe(403);
    }
    loginAs(w.admin);
    expect((await download(jsonRequest("GET"), idParams("nope"))).status).toBe(404);

    const row = await prisma.attachment.findUniqueOrThrow({ where: { id } });
    await getStorage().delete(row.storageKey);
    expect((await download(jsonRequest("GET"), idParams(id))).status).toBe(404);
  });
});

describe("deleting", () => {
  it("the uploader can remove their own file; the bytes and the row both go", async () => {
    const w = await world();
    const id = await uploaded(w, w.customer);
    expect(await storedFiles()).toHaveLength(1);

    loginAs(w.customer);
    expect((await remove(jsonRequest("DELETE"), idParams(id))).status).toBe(200);
    expect(await prisma.attachment.count()).toBe(0);
    expect(await storedFiles()).toEqual([]);
    expect((await remove(jsonRequest("DELETE"), idParams(id))).status).toBe(404);
  });

  it("others on the ticket cannot remove it, but an admin can", async () => {
    const w = await world();
    const id = await uploaded(w, w.agent, "agent.png");

    loginAs(w.customer);
    expect((await remove(jsonRequest("DELETE"), idParams(id))).status).toBe(403);
    loginAs(w.otherAgent);
    expect((await remove(jsonRequest("DELETE"), idParams(id))).status).toBe(403);
    expect(await prisma.attachment.count()).toBe(1);

    loginAs(w.admin);
    expect((await remove(jsonRequest("DELETE"), idParams(id))).status).toBe(200);
    expect(await prisma.attachment.count()).toBe(0);
  });

  it("deleting a comment removes its attachment rows", async () => {
    const w = await world();
    const comment = await prisma.comment.create({ data: { ticketId: w.ticket.id, authorId: w.customer.id, body: "x" } });
    await uploaded(w, w.customer, "a.png", PNG, { commentId: comment.id });
    await prisma.comment.delete({ where: { id: comment.id } });
    expect(await prisma.attachment.count()).toBe(0);
  });
});

describe("ticket detail includes attachments", () => {
  it("lists name, size, type and uploader", async () => {
    const w = await world();
    await uploaded(w, w.agent, "evidence.png");
    loginAs(w.customer);
    const t = (await (await getTicket(jsonRequest("GET"), idParams(w.ticket.id))).json()) as { attachments: Record<string, unknown>[] };
    expect(t.attachments).toHaveLength(1);
    expect(t.attachments[0]).toMatchObject({
      fileName: "evidence.png", mimeType: "image/png", fileSize: PNG.length, commentId: null, uploadedBy: { name: "agent" },
    });
    expect(t.attachments[0]).not.toHaveProperty("storageKey"); // internal detail never leaves the server
  });
});
