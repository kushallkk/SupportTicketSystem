import { execSync } from "node:child_process";
import path from "node:path";
import { resolveTestDatabaseUrl } from "./integration/guard";

// Applies pending Prisma migrations to the TEST database only (guard refuses the main DB),
// so integration/E2E runs always see the current schema. Retries because the DB is a remote
// free-tier Neon instance and the first connection can fail while it wakes up or the network blips.
const webDir = path.resolve(__dirname, "..");
// Migrations must use Neon's DIRECT endpoint, not the "-pooler" one. Prisma takes a session-level
// advisory lock; through pgbouncer that lock sticks to a pooled server connection and later
// migrations then time out with P1002.
const url = resolveTestDatabaseUrl(webDir).replace("-pooler", "");

const ATTEMPTS = 4;
for (let attempt = 1; ; attempt++) {
  try {
    execSync("npx prisma migrate deploy", {
      cwd: webDir,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url },
    });
    break;
  } catch (error) {
    if (attempt === ATTEMPTS) throw error;
    console.warn(`migrate attempt ${attempt}/${ATTEMPTS} failed; retrying in ${attempt * 5}s...`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 5000);
  }
}
