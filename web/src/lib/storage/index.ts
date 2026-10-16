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

let cached: { driver: string; root: string; storage: StorageDriver } | null = null;

export function getStorage(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  const root = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads");
  if (cached && cached.driver === driver && cached.root === root) return cached.storage;

  if (driver !== "local") {
    throw new Error(`Unsupported STORAGE_DRIVER "${driver}". Only "local" is available right now.`);
  }
  cached = { driver, root, storage: new LocalDiskStorage(root) };
  return cached.storage;
}
