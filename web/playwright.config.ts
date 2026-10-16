import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { resolveTestDatabaseUrl } from "./tests/integration/guard";

const WEB_PORT = 3100;
const ML_STUB_PORT = 8001;
const UPLOAD_DIR = path.resolve(__dirname, ".uploads-e2e");

// Throws (aborting the run) if the test DB is missing or is the main database.
const databaseUrl = resolveTestDatabaseUrl(__dirname);

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  // One shared test database, so tests run strictly one after another.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/ml-stub.mjs",
      url: `http://localhost:${ML_STUB_PORT}/health`,
      reuseExistingServer: false,
      env: { ML_STUB_PORT: String(ML_STUB_PORT) },
    },
    {
      // Production build in its own dir (.next-e2e) so it can't clash with `npm run dev`.
      command: "npm run build && npm run start",
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e",
        UPLOAD_DIR,
        ML_ADMIN_TOKEN: "e2e-admin-token",
        PORT: String(WEB_PORT),
        DATABASE_URL: databaseUrl,
        ML_SERVICE_URL: `http://localhost:${ML_STUB_PORT}`,
        NEXTAUTH_URL: `http://localhost:${WEB_PORT}`,
        AUTH_URL: `http://localhost:${WEB_PORT}`,
        AUTH_TRUST_HOST: "true",
        NEXTAUTH_SECRET: "e2e-only-secret-not-used-anywhere-else",
        AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else",
      },
    },
  ],
});
