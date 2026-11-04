import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Run every test in UTC (like Vercel), so code that leans on the server's zone fails here
// instead of passing on a machine set to Asia/Seoul. Set before workers start.
process.env.TZ = "UTC";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Tests run outside React Server Components; treat the guard as a no-op. Found by
      // Node resolution (so a git worktree without node_modules uses the parent's); the
      // package exports only ".", so take empty.js next to its entry.
      "server-only": join(
        dirname(createRequire(import.meta.url).resolve("server-only")),
        "empty.js",
      ),
    },
  },
  // tsconfig keeps JSX as-is for Next; tests need it compiled.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    env: { TZ: "UTC" },
    include: ["tests/unit/**/*.test.ts"],
    // next-auth imports `next/server` without an extension; bundling it lets Vite resolve that.
    server: { deps: { inline: ["next-auth"] } },
  },
});
