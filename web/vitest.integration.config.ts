import { defineConfig } from "vitest/config";
import os from "node:os";
import path from "node:path";
import { resolveTestDatabaseUrl } from "./tests/integration/guard";

// Throws (aborting the run) if the test DB is missing or is the main database.
const testDatabaseUrl = resolveTestDatabaseUrl(__dirname);

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl,
      // Uploaded files go to a throwaway folder, never the real .uploads/.
      UPLOAD_DIR: path.join(os.tmpdir(), "resolveiq-integration-uploads"),
    },
    // One shared database: files must not run in parallel or they'd truncate each other's data.
    fileParallelism: false,
    // The DB is remote (Neon free tier): one retry absorbs a transient network blip without hiding real failures.
    retry: 1,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
