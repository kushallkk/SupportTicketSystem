import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Where uploaded bytes live. The database only stores an opaque `storageKey`; swapping the backend
 * (local disk now, a hosted object store when deployed) never touches the rest of the app.
 */
export interface StorageDriver {
  put(key: string, data: Uint8Array): Promise<void>;
  /** Returns null if the object does not exist. */
  get(key: string): Promise<Uint8Array | null>;
  /** Deleting something that is already gone is not an error. */
  delete(key: string): Promise<void>;
}

/** Random, server-generated key. The user's filename is never part of it. */
export function newStorageKey(ticketId: string): string {
  return `tickets/${ticketId}/${randomUUID()}`;
}

const SAFE_KEY = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/;

class LocalDiskStorage implements StorageDriver {
  constructor(private readonly root: string) {}

  /** Resolves a key to a path, refusing anything that could escape the upload directory. */
  private resolve(key: string): string {
    if (!SAFE_KEY.test(key)) throw new Error("Invalid storage key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Uint8Array) {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }

  async get(key: string) {
    try {
      return new Uint8Array(await fs.readFile(this.resolve(key)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

/**
 * Vercel Blob, in a PRIVATE store: nothing here is reachable by URL, so every download has to go through
 * our own route, which checks the viewer's access to the ticket first.
 */
class VercelBlobStorage implements StorageDriver {
  async put(key: string, data: Uint8Array) {
    const { put } = await import("@vercel/blob");
    await put(key, Buffer.from(data), { access: "private", addRandomSuffix: false, allowOverwrite: true });
  }

  async get(key: string) {
    const { get } = await import("@vercel/blob");
    const result = await get(key, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  }

  async delete(key: string) {
    const { del } = await import("@vercel/blob");
    await del(key);
  }
}

let cached: { driver: string; root: string; storage: StorageDriver } | null = null;

export function getStorage(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads");
  if (cached && cached.driver === driver && cached.root === root) return cached.storage;

  if (driver !== "local" && driver !== "blob") {
    throw new Error(`Unsupported STORAGE_DRIVER "${driver}". Use "local" or "blob".`);
  }
  if (driver === "blob" && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('STORAGE_DRIVER="blob" needs BLOB_READ_WRITE_TOKEN (create a Blob store in the Vercel project).');
  }
  cached = { driver, root, storage: driver === "blob" ? new VercelBlobStorage() : new LocalDiskStorage(root) };
  return cached.storage;
}
