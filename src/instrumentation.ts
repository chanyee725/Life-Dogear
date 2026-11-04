/**
 * Runs once when the Next.js server starts. Starts the daily local backup (see
 * `src/lib/backup`) on the Node.js runtime only: not in the Edge runtime, not while
 * building, not on Vercel. A failure here must never stop the app.
 */
export async function register() {
  // Keep this exact `=== "nodejs"` block: Next replaces NEXT_RUNTIME at build time and drops
  // the import from the Edge bundle, which cannot load `node:fs`.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build" || process.env.VERCEL) return;
    try {
      const { startBackupSchedule } = await import("./lib/backup/schedule");
      startBackupSchedule();
    } catch {
      console.warn("백업 실패(start)");
    }
  }
}
