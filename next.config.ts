import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — Next.js must not try to bundle it
  // for the server build, just `require()` it at runtime.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
