import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
  experimental: {
    // Markdown bodies up to ~500k Korean characters (3 bytes each in UTF-8).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
