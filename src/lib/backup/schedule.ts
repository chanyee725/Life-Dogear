import { isVercelEnv, runBackup, type RunBackupOptions } from "./index";

/** How often the running server checks whether a day has passed since the last backup. */
export const BACKUP_CHECK_MS = 60 * 60 * 1000;
/** Let the server finish starting before the first check. */
export const FIRST_CHECK_DELAY_MS = 30 * 1000;

const state = globalThis as unknown as {
  __researchBrainBackupTimers?: { first: NodeJS.Timeout; every: NodeJS.Timeout };
};

/**
 * Backs up shortly after the server starts when the last backup is a day old or more, then
 * checks every hour so a server left running backs up once a day. Started once per process
 * (dev reloads call it again); timers do not keep the process alive. Does nothing on Vercel.
 */
export function startBackupSchedule(options: RunBackupOptions = {}): boolean {
  if (isVercelEnv(options.env ?? process.env) || state.__researchBrainBackupTimers) return false;
  const tick = () => {
    void runBackup({ ...options, onlyIfDue: true }).catch(() => {});
  };
  const first = setTimeout(tick, FIRST_CHECK_DELAY_MS);
  const every = setInterval(tick, BACKUP_CHECK_MS);
  first.unref();
  every.unref();
  state.__researchBrainBackupTimers = { first, every };
  return true;
}

/** Tests only. */
export function stopBackupSchedule(): void {
  const timers = state.__researchBrainBackupTimers;
  if (!timers) return;
  clearTimeout(timers.first);
  clearInterval(timers.every);
  delete state.__researchBrainBackupTimers;
}
