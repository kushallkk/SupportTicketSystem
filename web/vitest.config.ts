import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests (real DB) live in tests/integration and run via `npm run test:integration`.
    exclude: ["node_modules", "tests/integration/**"],
  },
});
