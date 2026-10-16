import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only. Lets you open the app at 127.0.0.1 and [::1] as well as localhost: each hostname has its
  // own cookies, so that gives you separate logins (e.g. admin / agent / customer) side by side.
  // Without it Next blocks its own dev scripts on those addresses and the pages never become interactive.
  allowedDevOrigins: ["127.0.0.1", "[::1]"],
  // The E2E suite builds into its own directory so it never clashes with a running `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
