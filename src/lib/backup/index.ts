import { cp, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { resolveDbConfig } from "@/db/config";
import { dataDir, type Env } from "@/lib/data-dir";

/**
 * Local backups: a consistent copy of the SQLite file (`VACUUM INTO`, never a file copy,
 * so a running server cannot leave a torn copy) plus `<DATA_DIR>/images` and `pdfs`, in
 * `<BACKUP_DIR>/YYYY-MM-DD[-HHmm]/` (Seoul time). Only the newest {@link KEEP_BACKUPS}
 * folders whose name has that form are kept; nothing else in `BACKUP_DIR` is touched.
 *
 * - Turso (`DATABASE_URL` not `file:`): the database is skipped (Turso keeps its own
 *   point-in-time backups); local files are still copied.
 * - Vercel: nothing at all.
 *
 * Never throws: failures come back as `{ status: "failed", step }`. Logs carry the step
 * name only — never paths, file names, URLs or error text (which can hold paths).
 */

export const KEEP_BACKUPS = 14;
export const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** A lock older than this is from a crashed run and is taken over. */
export const STALE_LOCK_MS = 2 * 60 * 60 * 1000;
const FILE_DIRS = ["images", "pdfs"] as const;
const MANIFEST = "backup.json";
const LOCK = ".backup.lock";
const PARTIAL_PREFIX = ".partial-";

/** Backup folder names this module creates (and the only ones it ever deletes). */
export const BACKUP_NAME_RE = /^\d{4}-\d{2}-\d{2}(?:-\d{4})?$/;

export type BackupStep = "config" | "lock" | "prepare" | "db" | "files" | "finalize" | "prune";

export type BackupResult =
  | {
      status: "done";
      /** Folder name, e.g. `2026-11-04`. */
      name: string;
      db: "copied" | "turso" | "missing";
      files: number;
      pruned: number;
    }
  | { status: "skipped"; reason: "vercel" | "busy" | "recent" }
  | { status: "failed"; step: BackupStep };

export type DbSource = { kind: "file"; path: string } | { kind: "turso" } | { kind: "none" };

export type BackupPlan = {
  /** Absolute folder holding the dated backups. */
  backupRoot: string;
  /** Absolute `DATA_DIR`. */
  dataRoot: string;
  db: DbSource;
};

export type BackupLogger = { info(message: string): void; warn(message: string): void };

const filled = (env: Env, key: string) => Boolean(env[key]?.trim());

export const isVercelEnv = (env: Env): boolean => filled(env, "VERCEL");

/** `BACKUP_DIR` relative to `root` (or absolute); default `<DATA_DIR>/backups`. */
export function backupDir(env: Env = process.env): string {
  const raw = env.BACKUP_DIR?.trim();
  return raw || `${dataDir(env)}/backups`;
}

function dbSource(env: Env, root: string): DbSource {
  const { url } = resolveDbConfig(env);
  if (!url.startsWith("file:")) return { kind: "turso" };
  let path: string;
  try {
    path = url.startsWith("file://") ? fileURLToPath(url) : url.slice("file:".length);
  } catch {
    return { kind: "none" };
  }
  path = path.replace(/[?#].*$/, "");
  if (!path || path === ":memory:") return { kind: "none" };
  return { kind: "file", path: resolve(root, path) };
}

const isInside = (child: string, parent: string) => {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

/** Where things are, from the environment; `root` is the project folder (tests: a temp dir). */
export function resolveBackupPlan(env: Env = process.env, root = process.cwd()): BackupPlan {
  const dataRoot = resolve(root, dataDir(env));
  const backupRoot = resolve(root, backupDir(env));
  // Backing up into a folder that is itself copied would nest every backup in the next.
  for (const dir of FILE_DIRS) {
    if (isInside(backupRoot, join(dataRoot, dir))) throw new Error("backup dir inside data");
  }
  return { backupRoot, dataRoot, db: dbSource(env, root) };
}

// --- naming and listing ---------------------------------------------------------------------

const seoulParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `YYYY-MM-DD` and `YYYY-MM-DD-HHmm` for an instant, in Seoul. */
export function backupNames(now: Date): [string, string] {
  const p = Object.fromEntries(seoulParts.formatToParts(now).map((x) => [x.type, x.value]));
  const day = `${p.year}-${p.month}-${p.day}`;
  return [day, `${day}-${p.hour}${p.minute}`];
}

const exists = async (path: string) => {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
};

/** Backup folders (real directories with the dated name), oldest first. */
export async function listBackups(backupRoot: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(backupRoot);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of names) {
    if (!BACKUP_NAME_RE.test(name)) continue;
    try {
      if ((await lstat(join(backupRoot, name))).isDirectory()) out.push(name);
    } catch {
      // vanished meanwhile
    }
  }
  return out.sort();
}

/** When the newest backup was made (its manifest, else the folder time); null if none. */
export async function lastBackupAt(backupRoot: string): Promise<Date | null> {
  const names = await listBackups(backupRoot);
  let latest: Date | null = null;
  for (const name of names) {
    const dir = join(backupRoot, name);
    let at: Date | null = null;
    try {
      const manifest = JSON.parse(await readFile(join(dir, MANIFEST), "utf8")) as {
        createdAt?: unknown;
      };
      const parsed = typeof manifest.createdAt === "string" ? new Date(manifest.createdAt) : null;
      if (parsed && !Number.isNaN(parsed.getTime())) at = parsed;
    } catch {
      // no or unreadable manifest
    }
    if (!at) {
      try {
        at = (await stat(dir)).mtime;
      } catch {
        continue;
      }
    }
    if (!latest || at > latest) latest = at;
  }
  return latest;
}

/** True when there is no backup yet or the last one is at least a day old. */
export const isBackupDue = (last: Date | null, now: Date): boolean =>
  !last || now.getTime() - last.getTime() >= BACKUP_INTERVAL_MS;

/** Deletes the oldest dated folders beyond `keep`; returns how many went. */
export async function pruneBackups(backupRoot: string, keep = KEEP_BACKUPS): Promise<number> {
  const names = await listBackups(backupRoot);
  const old = names.slice(0, Math.max(0, names.length - keep));
  for (const name of old) await rm(join(backupRoot, name), { recursive: true, force: true });
  return old.length;
}

// --- lock -----------------------------------------------------------------------------------

const inProcess = globalThis as unknown as { __researchBrainBackupRunning?: boolean };

/** Cross-process lock (a file made with `wx`), so `npm run backup` and the server never overlap. */
async function takeLock(backupRoot: string, now: Date): Promise<(() => Promise<void>) | null> {
  const path = join(backupRoot, LOCK);
  const write = () =>
    writeFile(path, JSON.stringify({ pid: process.pid, at: now.toISOString() }), { flag: "wx" });
  try {
    await write();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const info = await stat(path).catch(() => null);
    if (info && now.getTime() - info.mtime.getTime() < STALE_LOCK_MS) return null;
    await rm(path, { force: true });
    try {
      await write();
    } catch {
      return null;
    }
  }
  return () => rm(path, { force: true });
}

// --- run ------------------------------------------------------------------------------------

async function countFiles(dir: string): Promise<number> {
  let n = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += await countFiles(join(dir, entry.name));
    else if (entry.isFile()) n += 1;
  }
  return n;
}

async function vacuumInto(source: string, target: string): Promise<void> {
  const client = createClient({ url: `file:${source}` });
  try {
    await client.execute("PRAGMA busy_timeout = 10000");
    await client.execute({ sql: "VACUUM INTO ?", args: [target] });
  } finally {
    client.close();
  }
  const copy = createClient({ url: `file:${target}` });
  try {
    const check = await copy.execute("PRAGMA quick_check");
    if (check.rows[0]?.[0] !== "ok") throw new Error("backup check failed");
  } finally {
    copy.close();
  }
}

export type RunBackupOptions = {
  env?: Env;
  root?: string;
  now?: Date;
  /** Skip the backup when the last one is younger than a day (server start and daily tick). */
  onlyIfDue?: boolean;
  keep?: number;
  log?: BackupLogger;
};

const TURSO_NOTICE = "백업: Turso DB는 건너뜁니다. Turso는 자체 백업(시점 복구)을 쓰세요.";

export async function runBackup(options: RunBackupOptions = {}): Promise<BackupResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const log = options.log ?? console;
  if (isVercelEnv(env)) return { status: "skipped", reason: "vercel" };
  if (inProcess.__researchBrainBackupRunning) return { status: "skipped", reason: "busy" };
  inProcess.__researchBrainBackupRunning = true;
  let step: BackupStep = "config";
  let release: (() => Promise<void>) | null = null;
  let partial: string | null = null;
  try {
    const plan = resolveBackupPlan(env, options.root);
    step = "lock";
    await mkdir(plan.backupRoot, { recursive: true });
    release = await takeLock(plan.backupRoot, now);
    if (!release) return { status: "skipped", reason: "busy" };
    // Checked under the lock, so a run that just finished elsewhere counts.
    if (options.onlyIfDue && !isBackupDue(await lastBackupAt(plan.backupRoot), now)) {
      return { status: "skipped", reason: "recent" };
    }

    step = "prepare";
    const [day, minute] = backupNames(now);
    let name = day;
    if (await exists(join(plan.backupRoot, name))) name = minute;
    if (await exists(join(plan.backupRoot, name))) return { status: "skipped", reason: "recent" };
    partial = join(plan.backupRoot, `${PARTIAL_PREFIX}${crypto.randomUUID()}`);
    await mkdir(partial);

    step = "db";
    let db: "copied" | "turso" | "missing" = "missing";
    if (plan.db.kind === "turso") {
      db = "turso";
      log.info(TURSO_NOTICE);
    } else if (plan.db.kind === "file" && (await exists(plan.db.path))) {
      await vacuumInto(plan.db.path, join(partial, basename(plan.db.path)));
      db = "copied";
    }

    step = "files";
    let files = 0;
    for (const dir of FILE_DIRS) {
      const from = join(plan.dataRoot, dir);
      if (!(await exists(from))) continue;
      const to = join(partial, dir);
      // Half-written uploads end in `.tmp`; links are copied as links, never followed.
      await cp(from, to, {
        recursive: true,
        errorOnExist: true,
        force: false,
        verbatimSymlinks: true,
        filter: (src) => !src.endsWith(".tmp"),
      });
      files += await countFiles(to);
    }

    step = "finalize";
    await writeFile(
      join(partial, MANIFEST),
      `${JSON.stringify({ createdAt: now.toISOString(), db, files }, null, 2)}\n`,
    );
    await rename(partial, join(plan.backupRoot, name));
    partial = null;

    step = "prune";
    const pruned = await pruneBackups(plan.backupRoot, options.keep ?? KEEP_BACKUPS);
    return { status: "done", name, db, files, pruned };
  } catch {
    log.warn(`백업 실패(${step})`);
    return { status: "failed", step };
  } finally {
    if (partial) await rm(partial, { recursive: true, force: true }).catch(() => {});
    if (release) await release().catch(() => {});
    inProcess.__researchBrainBackupRunning = false;
  }
}
