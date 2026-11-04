import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Run every test in UTC (like Vercel), so code that leans on the server's zone fails here
// instead of passing on a machine set to Asia/Seoul. Set before workers start.
process.env.TZ = "UTC";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Tests run outside React Server Components; treat the guard as a no-op.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
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
