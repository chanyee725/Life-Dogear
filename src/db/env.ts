import * as nextEnvModule from "@next/env";

// @next/env is CommonJS: tsx (ESM) exposes it under `default`, drizzle-kit's
// loader exposes the named export directly. Accept both.
const { loadEnvConfig } =
  (nextEnvModule as { default?: typeof nextEnvModule }).default ?? nextEnvModule;

/**
 * Loads env files for CLI entry points (drizzle-kit, seed) the same way Next.js
 * does (`.env`, `.env.local`, `.env.development*`). Missing files are fine:
 * the local database is the fallback. Only file names are logged, never values.
 */
export function loadEnvIfPresent(): void {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
}
