import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
    include: ["tests/unit/**/*.test.ts"],
    // next-auth imports `next/server` without an extension; bundling it lets Vite resolve that.
    server: { deps: { inline: ["next-auth"] } },
  },
});
