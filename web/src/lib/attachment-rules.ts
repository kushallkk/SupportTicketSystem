/**
 * Upload rules for ticket attachments. Pure and isomorphic (no Node APIs) so the same checks run
 * in the browser for instant feedback and on the server, where they are authoritative.
 *
 * Security stance: never trust the client's filename or Content-Type. A file is accepted only if
 * its extension is allow-listed AND its leading bytes really are that kind of file. SVG and HTML
 * are deliberately not allowed: they can carry scripts.
 */

// 4 MB, not 5: Vercel rejects request bodies over ~4.5 MB, and the client sends one file per request.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 5;
export const MAX_ATTACHMENTS_PER_TICKET = 20;

export type FileKind = "png" | "jpeg" | "gif" | "webp" | "pdf" | "text";

const BY_EXTENSION: Record<string, { kind: FileKind; mime: string }> = {
  png: { kind: "png", mime: "image/png" },
  jpg: { kind: "jpeg", mime: "image/jpeg" },
  jpeg: { kind: "jpeg", mime: "image/jpeg" },
  gif: { kind: "gif", mime: "image/gif" },
  webp: { kind: "webp", mime: "image/webp" },
  pdf: { kind: "pdf", mime: "application/pdf" },
  txt: { kind: "text", mime: "text/plain" },
  log: { kind: "text", mime: "text/plain" },
  csv: { kind: "text", mime: "text/csv" },
};

export const ALLOWED_EXTENSIONS = Object.keys(BY_EXTENSION);
/** For <input accept="..."> */
export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

export function extensionOf(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isInlineImage(mimeType: string): boolean {
  return mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/gif" || mimeType === "image/webp";
}

/** Strips any path, control characters and characters that are awkward in headers/filesystems. */
export function sanitizeFileName(name: string): string {
  let base = (name.split(/[\\/]/).pop() ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/["<>:|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");

  if (base.length > 100) {
    const ext = extensionOf(base);
    const stem = ext ? base.slice(0, base.length - ext.length - 1) : base;
    base = stem.slice(0, 100 - (ext ? ext.length + 1 : 0)) + (ext ? `.${ext}` : "");
  }
  return base || "file";
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b);
}

const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));

/** Identifies a file from its leading bytes alone. Returns null if it is none of the allowed kinds. */
export function sniffKind(bytes: Uint8Array): FileKind | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "gif";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "webp";
  if (startsWith(bytes, ascii("%PDF-"))) return "pdf";

  // Text: no NUL bytes and valid UTF-8 all the way through.
  if (bytes.length > 0 && !bytes.includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return "text";
    } catch {
      return null;
    }
  }
  return null;
}

export type UploadCheck =
  | { ok: true; fileName: string; mimeType: string; kind: FileKind }
  | { ok: false; error: string };

/** Cheap checks that need only the name and size, usable before reading the file. */
export function quickCheck(name: string, size: number): { ok: true } | { ok: false; error: string } {
  const label = sanitizeFileName(name);
  if (size === 0) return { ok: false, error: `"${label}" is empty.` };
  if (size > MAX_FILE_BYTES) {
    return { ok: false, error: `"${label}" is ${formatBytes(size)}; the limit is ${formatBytes(MAX_FILE_BYTES)}.` };
  }
  const ext = extensionOf(name);
  if (!(ext in BY_EXTENSION)) {
    return {
      ok: false,
      error: `"${label}" isn't an allowed file type. Allowed: ${ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(", ")}.`,
    };
  }
  return { ok: true };
}

/** Full server-side check: name, size, extension AND real content. */
export function validateUpload(file: { name: string; size: number; bytes: Uint8Array }): UploadCheck {
  const quick = quickCheck(file.name, file.size);
  if (!quick.ok) return quick;

  const fileName = sanitizeFileName(file.name);
  const expected = BY_EXTENSION[extensionOf(file.name)];
  const actual = sniffKind(file.bytes);
  if (actual !== expected.kind) {
    return { ok: false, error: `"${fileName}" doesn't look like a real .${extensionOf(file.name)} file.` };
  }
  return { ok: true, fileName, mimeType: expected.mime, kind: expected.kind };
}

export function checkBatchSize(existingCount: number, incomingCount: number): { ok: true } | { ok: false; error: string } {
  if (incomingCount === 0) return { ok: false, error: "No files were uploaded." };
  if (incomingCount > MAX_FILES_PER_UPLOAD) {
    return { ok: false, error: `You can upload at most ${MAX_FILES_PER_UPLOAD} files at a time.` };
  }
  if (existingCount + incomingCount > MAX_ATTACHMENTS_PER_TICKET) {
    return { ok: false, error: `A ticket can have at most ${MAX_ATTACHMENTS_PER_TICKET} attachments.` };
  }
  return { ok: true };
}
