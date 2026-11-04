import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  backupDir,
  backupNames,
  isBackupDue,
  lastBackupAt,
  listBackups,
  pruneBackups,
  removeStalePartials,
  resolveBackupPlan,
  runBackup,
  takeLock,
  type BackupLogger,
} from "@/lib/backup";
import { startBackupSchedule, stopBackupSchedule } from "@/lib/backup/schedule";

const NOW = new Date("2026-11-04T03:00:00Z"); // 12:00 in Seoul
const DAY = 24 * 60 * 60 * 1000;

let root: string;
const logs: string[] = [];
const log: BackupLogger = { info: (m) => logs.push(m), warn: (m) => logs.push(m) };
const LOCAL = { DATA_DIR: "data" };

async function seedDb(rows: string[]) {
  await mkdir(join(root, "data"), { recursive: true });
  const db = createClient({ url: `file:${join(root, "data/local.db")}` });
  await db.execute("CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT)");
  for (const title of rows)
    await db.execute({ sql: "INSERT INTO notes (title) VALUES (?)", args: [title] });
  db.close();
}

/** A finished backup folder as runBackup leaves it (dated name + manifest). */
async function fakeBackup(dir: string, name: string, createdAt = "2026-10-01T00:00:00Z") {
  await mkdir(join(dir, name), { recursive: true });
  await writeFile(join(dir, name, "backup.json"), JSON.stringify({ createdAt }));
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "rb-backup-"));
  logs.length = 0;
});
afterEach(async () => {
  stopBackupSchedule();
  vi.useRealTimers();
  await rm(root, { recursive: true, force: true });
});

describe("settings", () => {
  it("defaults BACKUP_DIR to <DATA_DIR>/backups", () => {
    expect(backupDir({})).toBe("data/backups");
    expect(backupDir({ DATA_DIR: "data/e2e" })).toBe("data/e2e/backups");
    expect(backupDir({ BACKUP_DIR: " /srv/backups " })).toBe("/srv/backups");
  });

  it("reads the DB source and refuses a backup dir inside a copied folder", () => {
    expect(resolveBackupPlan(LOCAL, root).db).toEqual({
      kind: "file",
      path: join(root, "data/local.db"),
    });
    expect(resolveBackupPlan({ DATABASE_URL: "file:./data/e2e/e2e.db" }, root).db).toEqual({
      kind: "file",
      path: join(root, "data/e2e/e2e.db"),
    });
    expect(resolveBackupPlan({ DATABASE_URL: "libsql://x.turso.io" }, root).db).toEqual({
      kind: "turso",
    });
    expect(() => resolveBackupPlan({ BACKUP_DIR: "data/images/bk" }, root)).toThrow();
  });

  it("names folders by the Seoul date", () => {
    expect(backupNames(NOW)).toEqual(["2026-11-04", "2026-11-04-1200"]);
    expect(backupNames(new Date("2026-11-04T15:30:00Z"))).toEqual([
      "2026-11-05",
      "2026-11-05-0030",
    ]);
  });
});

describe("runBackup", () => {
  it("copies the DB with VACUUM INTO and the photo and PDF folders", async () => {
    await seedDb(["가", "나"]);
    await mkdir(join(root, "data/images"), { recursive: true });
    await mkdir(join(root, "data/pdfs"), { recursive: true });
    await writeFile(join(root, "data/images/a.png"), "png");
    await writeFile(join(root, "data/images/b.png.123.tmp"), "half");
    await writeFile(join(root, "data/pdfs/p.pdf"), "pdf");

    const result = await runBackup({ env: LOCAL, root, now: NOW, log });
    expect(result).toEqual({
      status: "done",
      name: "2026-11-04",
      db: "copied",
      files: 2,
      pruned: 0,
    });

    const dir = join(root, "data/backups/2026-11-04");
    const copy = createClient({ url: `file:${join(dir, "local.db")}` });
    const rows = await copy.execute("SELECT title FROM notes ORDER BY id");
    copy.close();
    expect(rows.rows.map((r) => r.title)).toEqual(["가", "나"]);
    expect(await readdir(join(dir, "images"))).toEqual(["a.png"]);
    expect(await readFile(join(dir, "pdfs/p.pdf"), "utf8")).toBe("pdf");
    expect(JSON.parse(await readFile(join(dir, "backup.json"), "utf8"))).toMatchObject({
      createdAt: NOW.toISOString(),
      db: "copied",
    });
    // No temp folders or lock left behind.
    expect((await readdir(join(root, "data/backups"))).sort()).toEqual(["2026-11-04"]);
    expect(logs).toEqual([]);
  });

  it("uses a minute-stamped name for a second backup the same day", async () => {
    await seedDb(["x"]);
    await runBackup({ env: LOCAL, root, now: NOW, log });
    const second = await runBackup({
      env: LOCAL,
      root,
      now: new Date(NOW.getTime() + 60_000),
      log,
    });
    expect(second).toMatchObject({ status: "done", name: "2026-11-04-1201" });
  });

  it("skips the Turso DB with a notice but still copies files", async () => {
    await mkdir(join(root, "data/images"), { recursive: true });
    await writeFile(join(root, "data/images/a.png"), "png");
    const env = { DATABASE_URL: "libsql://example.turso.io", DATABASE_AUTH_TOKEN: "secret-token" };
    const result = await runBackup({ env, root, now: NOW, log });
    expect(result).toMatchObject({ status: "done", db: "turso", files: 1 });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("Turso");
    expect(logs.join()).not.toMatch(/example|secret|libsql/);
    expect(await readdir(join(root, "data/backups/2026-11-04"))).not.toContain("local.db");
  });

  it("does nothing on Vercel", async () => {
    await seedDb(["x"]);
    expect(await runBackup({ env: { ...LOCAL, VERCEL: "1" }, root, now: NOW, log })).toEqual({
      status: "skipped",
      reason: "vercel",
    });
    await expect(readdir(join(root, "data/backups"))).rejects.toThrow();
  });

  it("only backs up when due, judged by the last backup's time", async () => {
    await seedDb(["x"]);
    await runBackup({ env: LOCAL, root, now: NOW, log });
    const soon = new Date(NOW.getTime() + DAY - 1000);
    expect(await runBackup({ env: LOCAL, root, now: soon, onlyIfDue: true, log })).toEqual({
      status: "skipped",
      reason: "recent",
    });
    const later = new Date(NOW.getTime() + DAY);
    expect(await runBackup({ env: LOCAL, root, now: later, onlyIfDue: true, log })).toMatchObject({
      status: "done",
      name: "2026-11-05",
    });
  });

  it("does not run while another process holds the lock, and takes over a stale one", async () => {
    await seedDb(["x"]);
    await mkdir(join(root, "data/backups"), { recursive: true });
    await writeFile(join(root, "data/backups/.backup.lock"), "{}");
    expect(await runBackup({ env: LOCAL, root, now: NOW, log })).toEqual({
      status: "skipped",
      reason: "busy",
    });
    const muchLater = new Date(Date.now() + 3 * 60 * 60 * 1000);
    expect(await runBackup({ env: LOCAL, root, now: muchLater, log })).toMatchObject({
      status: "done",
    });
  });

  it("runs once at a time inside one process", async () => {
    await seedDb(["x"]);
    const [a, b] = await Promise.all([
      runBackup({ env: LOCAL, root, now: NOW, log }),
      runBackup({ env: LOCAL, root, now: NOW, log }),
    ]);
    expect([a.status, b.status].sort()).toEqual(["done", "skipped"]);
  });

  it("reports the failed step only and leaves no partial folder", async () => {
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(join(root, "data/local.db"), "not a database at all, just text");
    const result = await runBackup({ env: LOCAL, root, now: NOW, log });
    expect(result).toEqual({ status: "failed", step: "db" });
    expect(logs).toEqual(["백업 실패(db)"]);
    expect(await readdir(join(root, "data/backups"))).toEqual([]);
  });
});

describe("retention", () => {
  it("keeps the newest 14 dated folders and touches nothing else", async () => {
    const dir = join(root, "backups");
    await mkdir(dir, { recursive: true });
    const names = Array.from({ length: 16 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
    names.push("2026-10-16-0930");
    for (const n of names) await fakeBackup(dir, n);
    await mkdir(join(dir, "keep-me"));
    await mkdir(join(dir, "2026-01-01-old"));
    await writeFile(join(dir, "2026-01-02"), "a file with a dated name");
    await mkdir(join(root, "outside"));
    await symlink(join(root, "outside"), join(dir, "2026-01-03"));

    expect(await pruneBackups(dir, 14)).toBe(3);
    const left = await readdir(dir);
    expect(await listBackups(dir)).toEqual(names.slice(3));
    for (const other of ["keep-me", "2026-01-01-old", "2026-01-02", "2026-01-03"]) {
      expect(left).toContain(other);
    }
    expect(await readdir(join(root, "outside"))).toEqual([]);
  });

  it("prunes after a backup", async () => {
    await seedDb(["x"]);
    const dir = join(root, "data/backups");
    await mkdir(dir, { recursive: true });
    for (let i = 1; i <= 14; i++) await fakeBackup(dir, `2026-10-${String(i).padStart(2, "0")}`);
    const result = await runBackup({ env: LOCAL, root, now: NOW, log });
    expect(result).toMatchObject({ status: "done", pruned: 1 });
    expect((await listBackups(dir))[0]).toBe("2026-10-02");
  });
});

describe("due", () => {
  it("is due with no backup or after 24 hours", async () => {
    expect(isBackupDue(null, NOW)).toBe(true);
    expect(isBackupDue(new Date(NOW.getTime() - DAY + 1), NOW)).toBe(false);
    expect(isBackupDue(new Date(NOW.getTime() - DAY), NOW)).toBe(true);
    expect(await lastBackupAt(join(root, "none"))).toBeNull();
  });
});

describe("startBackupSchedule", () => {
  it("starts once per process and never on Vercel", () => {
    vi.useFakeTimers();
    expect(startBackupSchedule({ env: { VERCEL: "1" }, root })).toBe(false);
    expect(startBackupSchedule({ env: LOCAL, root, log })).toBe(true);
    expect(startBackupSchedule({ env: LOCAL, root, log })).toBe(false);
  });
});

describe("review fixes", () => {
  it("backs up a DB whose folders contain # and %", async () => {
    const odd = join(root, "a#b%20c");
    await mkdir(join(odd, "data"), { recursive: true });
    const { pathToFileURL } = await import("node:url");
    const src = createClient({ url: pathToFileURL(join(odd, "data/local.db")).href });
    await src.execute("CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT)");
    await src.execute("INSERT INTO notes (title) VALUES ('가'), ('나')");
    src.close();

    const env = { DATA_DIR: "data", BACKUP_DIR: "bk#1%41?x" };
    const result = await runBackup({ env, root: odd, now: NOW, log });
    expect(result).toMatchObject({ status: "done", db: "copied" });
    const copy = createClient({
      url: pathToFileURL(join(odd, "bk#1%41?x/2026-11-04/local.db")).href,
    });
    const rows = await copy.execute("SELECT title FROM notes ORDER BY id");
    copy.close();
    expect(rows.rows.map((r) => r.title)).toEqual(["가", "나"]);
  });

  it("removes temp folders older than the stale-lock age and keeps fresh ones", async () => {
    const dir = join(root, "bk");
    const oldOne = ".partial-00000000-0000-4000-8000-000000000001";
    const newOne = ".partial-00000000-0000-4000-8000-000000000002";
    await mkdir(join(dir, oldOne), { recursive: true });
    await mkdir(join(dir, newOne));
    await mkdir(join(dir, ".partial-not-a-uuid"));
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await utimes(join(dir, oldOne), threeHoursAgo, threeHoursAgo);
    await utimes(join(dir, ".partial-not-a-uuid"), threeHoursAgo, threeHoursAgo);

    expect(await removeStalePartials(dir, new Date())).toBe(1);
    expect((await readdir(dir)).sort()).toEqual([".partial-not-a-uuid", newOne].sort());
  });

  it("runBackup clears a stale temp folder once it holds the lock", async () => {
    await seedDb(["x"]);
    const dir = join(root, "data/backups");
    const stale = ".partial-00000000-0000-4000-8000-000000000003";
    await mkdir(join(dir, stale), { recursive: true });
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await utimes(join(dir, stale), old, old);
    expect(await runBackup({ env: LOCAL, root, log })).toMatchObject({ status: "done" });
    expect(await readdir(dir)).not.toContain(stale);
  });

  it("ignores dated folders without a manifest for pruning and the 24-hour check", async () => {
    const dir = join(root, "bk");
    await mkdir(join(dir, "2026-01-01"), { recursive: true }); // someone else's folder
    await mkdir(join(dir, "2026-11-04"));
    for (let i = 1; i <= 15; i++) {
      await fakeBackup(dir, `2026-10-${String(i).padStart(2, "0")}`);
    }
    expect(await listBackups(dir)).not.toContain("2026-01-01");
    expect(await pruneBackups(dir, 14)).toBe(1);
    expect(await readdir(dir)).toEqual(expect.arrayContaining(["2026-01-01", "2026-11-04"]));
    // The bare 2026-11-04 folder (fresh mtime) does not count as a recent backup.
    expect(await lastBackupAt(dir)).toEqual(new Date("2026-10-01T00:00:00Z"));
  });

  it("releases only its own lock", async () => {
    await seedDb(["x"]);
    const dir = join(root, "data/backups");
    await mkdir(dir, { recursive: true });
    const lock = join(dir, ".backup.lock");
    // A stale lock is taken over; the old owner must not remove the new one afterwards.
    await writeFile(lock, JSON.stringify({ token: "other" }));
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await utimes(lock, old, old);
    const run = runBackup({ env: LOCAL, root, log });
    expect(await run).toMatchObject({ status: "done" });
    await expect(readFile(lock, "utf8")).rejects.toThrow(); // ours, released

    // Release after the lock changed hands leaves the new owner's file alone.
    const release = await takeLock(dir, new Date());
    expect(release).not.toBeNull();
    await writeFile(lock, JSON.stringify({ token: "someone-else" }));
    await release!();
    expect(JSON.parse(await readFile(lock, "utf8"))).toEqual({ token: "someone-else" });
  });
});
