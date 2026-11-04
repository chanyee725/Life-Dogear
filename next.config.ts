import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run serve` builds into its own folder so it can run next to `npm run dev` without clobbering .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Trace files from this project only (a parent folder with its own lockfile, e.g. a git
  // worktree checkout, would otherwise be taken as the root).
  outputFileTracingRoot: process.cwd(),
  // Native libsql binding: loaded from node_modules at runtime (traced into the Vercel
  // function), not bundled.
  serverExternalPackages: ["@libsql/client"],
  // /api/pdfjs reads cMaps, standard fonts, wasm decoders and ICC profiles from
  // node_modules/pdfjs-dist by a computed path, which tracing cannot see. List them so a
  // serverless deployment (Vercel) ships them with that function.
  outputFileTracingIncludes: {
    // Keys are globs: `[...path]` would be read as a character class.
    "/api/pdfjs/**": [
      "./node_modules/pdfjs-dist/package.json",
      "./node_modules/pdfjs-dist/cmaps/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/iccs/**",
      "./node_modules/pdfjs-dist/wasm/openjpeg.wasm",
      "./node_modules/pdfjs-dist/wasm/openjpeg_nowasm_fallback.js",
      "./node_modules/pdfjs-dist/wasm/jbig2.wasm",
      "./node_modules/pdfjs-dist/wasm/jbig2_nowasm_fallback.js",
      "./node_modules/pdfjs-dist/wasm/qcms_bg.wasm",
    ],
  },
  experimental: {
    // Markdown bodies up to ~500k Korean characters (3 bytes each in UTF-8).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
