import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The E2E suite builds into its own directory so it never clashes with a running `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
