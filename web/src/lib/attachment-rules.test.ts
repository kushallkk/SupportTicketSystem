import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENTS_PER_TICKET, MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES,
  checkBatchSize, extensionOf, formatBytes, isInlineImage, quickCheck, sanitizeFileName, sniffKind, validateUpload,
} from "./attachment-rules";

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16);
const GIF = text("GIF89a......");
const WEBP = Uint8Array.from([...text("RIFF"), 1, 2, 3, 4, ...text("WEBPVP8 ")]);
const PDF = text("%PDF-1.7\n%...");

describe("sniffKind identifies files by content, not name", () => {
  it.each([
    ["png", PNG], ["jpeg", JPEG], ["gif", GIF], ["webp", WEBP], ["pdf", PDF],
    ["text", text("Steps to reproduce:\n1. Open the app\n")],
    ["text", text("héllo wörld ✓ — unicode is fine")],
  ] as const)("%s", (kind, data) => {
    expect(sniffKind(data)).toBe(kind);
  });

  it("rejects binary junk, NUL bytes and invalid UTF-8", () => {
    expect(sniffKind(bytes(0, 1, 2, 3))).toBeNull();
    expect(sniffKind(bytes(0x68, 0x69, 0x00, 0x21))).toBeNull(); // "hi\0!"
    expect(sniffKind(bytes(0xff, 0xfe, 0xfd))).toBeNull();
    expect(sniffKind(new Uint8Array())).toBeNull();
  });

  it("a RIFF file that is not WEBP (e.g. a .wav) is not accepted as an image", () => {
    expect(sniffKind(Uint8Array.from([...text("RIFF"), 1, 2, 3, 4, ...text("WAVEfmt ")]))).not.toBe("webp");
  });
});

describe("validateUpload", () => {
  const ok = (name: string, data: Uint8Array) => validateUpload({ name, size: data.length, bytes: data });

  it.each([
    ["shot.png", PNG, "image/png"], ["photo.JPG", JPEG, "image/jpeg"], ["photo.jpeg", JPEG, "image/jpeg"],
    ["anim.gif", GIF, "image/gif"], ["pic.webp", WEBP, "image/webp"], ["report.pdf", PDF, "application/pdf"],
    ["notes.txt", text("hello"), "text/plain"], ["server.log", text("ERROR x"), "text/plain"],
    ["data.csv", text("a,b\n1,2"), "text/csv"],
  ])("accepts %s as %s", (name, data, mime) => {
    expect(ok(name, data)).toMatchObject({ ok: true, mimeType: mime });
  });

  it.each([
    ["logo.svg", text("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")],
    ["page.html", text("<html><script>alert(1)</script></html>")],
    ["run.exe", bytes(0x4d, 0x5a, 0x90, 0)], ["archive.zip", bytes(0x50, 0x4b, 3, 4)],
    ["noextension", text("hello")], ["script.js", text("alert(1)")],
  ])("rejects disallowed type %s", (name, data) => {
    expect(ok(name, data)).toMatchObject({ ok: false });
  });

  it("rejects a file whose content does not match its extension", () => {
    expect(ok("innocent.png", text("<html><script>alert(1)</script></html>"))).toMatchObject({
      ok: false, error: expect.stringContaining("doesn't look like a real .png"),
    });
    expect(ok("fake.pdf", PNG)).toMatchObject({ ok: false });
    expect(ok("fake.txt", PNG)).toMatchObject({ ok: false });
    expect(ok("fake.jpg", PDF)).toMatchObject({ ok: false });
  });

  it("rejects empty and oversized files", () => {
    expect(validateUpload({ name: "a.txt", size: 0, bytes: new Uint8Array() })).toMatchObject({ ok: false });
    expect(validateUpload({ name: "a.txt", size: MAX_FILE_BYTES + 1, bytes: text("x") })).toMatchObject({
      ok: false, error: expect.stringContaining("limit"),
    });
    expect(validateUpload({ name: "a.txt", size: MAX_FILE_BYTES, bytes: text("x") })).toMatchObject({ ok: true });
  });

  it("returns a sanitized display name", () => {
    expect(ok("..\\..\\evil/../shot.png", PNG)).toMatchObject({ ok: true, fileName: "shot.png" });
  });
});

describe("quickCheck (client-side, name + size only)", () => {
  it("flags type and size problems without reading the file", () => {
    expect(quickCheck("a.png", 10)).toEqual({ ok: true });
    expect(quickCheck("a.svg", 10)).toMatchObject({ ok: false });
    expect(quickCheck("a.png", MAX_FILE_BYTES + 1)).toMatchObject({ ok: false });
    expect(quickCheck("a.png", 0)).toMatchObject({ ok: false });
  });
});

describe("sanitizeFileName", () => {
  it.each([
    ["report.pdf", "report.pdf"],
    ["C:\\Users\\me\\Desktop\\report.pdf", "report.pdf"],
    ["../../etc/passwd", "passwd"],
    ["we\u0000ird\u001fname.txt", "weirdname.txt"],
    ['bad"name<>|?*.txt', "bad_name_____.txt"],
    ["   spaced   out   .txt", "spaced out .txt"],
    [".hidden", "hidden"],
    ["", "file"], ["///", "file"], ["...", "file"],
  ])("%j -> %j", (input, expected) => {
    expect(sanitizeFileName(input)).toBe(expected);
  });

  it("caps long names at 100 chars but keeps the extension", () => {
    const out = sanitizeFileName(`${"a".repeat(300)}.png`);
    expect(out.length).toBe(100);
    expect(out.endsWith(".png")).toBe(true);
  });

  it("never contains a path separator or header-breaking character", () => {
    const out = sanitizeFileName('a/b\\c"d\r\ne.txt');
    expect(out).not.toMatch(/[\\/"\r\n]/);
  });
});

describe("helpers", () => {
  it("extensionOf", () => {
    expect(extensionOf("a.PNG")).toBe("png");
    expect(extensionOf("archive.tar.gz")).toBe("gz");
    expect(extensionOf("noext")).toBe("");
    expect(extensionOf(".bashrc")).toBe("");
    expect(extensionOf("dir.d/file")).toBe("");
  });

  it("formatBytes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("isInlineImage only for raster images, never svg", () => {
    expect(isInlineImage("image/png")).toBe(true);
    expect(isInlineImage("image/svg+xml")).toBe(false);
    expect(isInlineImage("application/pdf")).toBe(false);
  });

  it("checkBatchSize enforces per-upload and per-ticket caps", () => {
    expect(checkBatchSize(0, 1)).toEqual({ ok: true });
    expect(checkBatchSize(0, 0)).toMatchObject({ ok: false });
    expect(checkBatchSize(0, MAX_FILES_PER_UPLOAD + 1)).toMatchObject({ ok: false });
    expect(checkBatchSize(MAX_ATTACHMENTS_PER_TICKET - 1, 2)).toMatchObject({ ok: false });
    expect(checkBatchSize(MAX_ATTACHMENTS_PER_TICKET - 2, 2)).toEqual({ ok: true });
  });
});
