import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run serve` builds into its own folder so it can run next to `npm run dev` without clobbering .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@libsql/client"],
  experimental: {
    // Markdown bodies up to ~500k Korean characters (3 bytes each in UTF-8).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
