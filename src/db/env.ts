/**
 * Loads `.env` into process.env for CLI entry points (drizzle-kit, seed).
 * Next.js loads it on its own. Missing file is fine: local DB fallback.
 */
export function loadEnvIfPresent(): void {
  try {
    process.loadEnvFile();
  } catch {
    // no .env — use defaults
  }
}
