import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/**
 * Integration tests TRUNCATE every table. These helpers make sure that can
 * only ever happen on a throwaway database, never the real one in web/.env.
 */

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function readEnvFile(file: string): Record<string, string> {
  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
}

export function readMainDatabaseUrl(webDir: string): string | undefined {
  return readEnvFile(path.join(webDir, ".env")).DATABASE_URL;
}

export function assertNotMainDatabase(testUrl: string | undefined, mainUrl: string | undefined) {
  const testHost = hostOf(testUrl);
  if (!testHost) throw new Error("Integration tests: the test DATABASE_URL is missing or not a valid URL.");

  const forbidden = [mainUrl, process.env.DATABASE_URL_MAIN].map(hostOf).filter((h): h is string => !!h);
  if (forbidden.includes(testHost)) {
    throw new Error(
      `Refusing to run integration tests: test database host (${testHost}) is the same as the main database in web/.env. ` +
        "Point web/.env.test (or TEST_DATABASE_URL) at a separate, disposable database."
    );
  }
}

/**
 * The test DB is remote (Neon, often far from the developer), so a reconnect can easily take
 * longer than Prisma's 5s default connect timeout and surface as "Can't reach database server".
 */
export function withResilientTimeouts(url: string): string {
  const u = new URL(url);
  if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "30");
  if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "30");
  return u.toString();
}

export function resolveTestDatabaseUrl(webDir: string): string {
  const url = process.env.TEST_DATABASE_URL ?? readEnvFile(path.join(webDir, ".env.test")).DATABASE_URL;
  if (!url) {
    throw new Error(
      "No test database configured. Create web/.env.test containing DATABASE_URL=... for a disposable database, " +
        "or set TEST_DATABASE_URL."
    );
  }
  assertNotMainDatabase(url, readMainDatabaseUrl(webDir));
  return withResilientTimeouts(url);
}
