import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";

async function apply(client: Client, file: string) {
  const sql = readFileSync(join("drizzle", file), "utf8");
  for (const stmt of sql.split("--> statement-breakpoint")) {
    const s = stmt.trim();
    if (s) await client.execute(s);
  }
}

const migrations = readdirSync("drizzle")
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("migration 0004 (tasks)", () => {
  it("only creates the tasks table and its indexes", () => {
    expect(migrations[4]).toMatch(/^0004_/);
    const sql = readFileSync(join("drizzle", migrations[4]!), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(3);
    expect(statements[0]).toMatch(/^CREATE TABLE `tasks`/);
    expect(statements.slice(1).every((s) => /^CREATE INDEX `tasks_\w+` ON `tasks`/.test(s))).toBe(
      true,
    );
    expect(sql).not.toMatch(/ALTER TABLE|DROP |INSERT INTO|__new_/i);
  });

  it("keeps existing rows and accepts tasks", async () => {
    dir = mkdtempSync(join(tmpdir(), "rb-mig4-"));
    const client = createClient({ url: `file:${join(dir, "m.db")}` });
    await client.execute("pragma foreign_keys = on");
    for (const m of migrations.slice(0, 4)) await apply(client, m);

    const t = "2026-11-01T00:00:00.000Z";
    await client.execute({
      sql: "insert into projects (id,title,created_at,updated_at) values ('p1','프로젝트',?,?)",
      args: [t, t],
    });
    await client.execute({
      sql: "insert into item_stars (item_type,item_id,created_at) values ('project','p1',?)",
      args: [t],
    });
    await apply(client, migrations[4]!);

    const project = await client.execute("select id, title from projects");
    expect(project.rows.map((r) => ({ ...r }))).toEqual([{ id: "p1", title: "프로젝트" }]);
    expect((await client.execute("select count(*) as n from item_stars")).rows[0]!.n).toBe(1);

    await client.execute({
      sql: "insert into tasks (id,title,parent_type,parent_id,sort_order,created_at,updated_at) values ('t1','할 일','project','p1',0,?,?)",
      args: [t, t],
    });
    const task = await client.execute("select title, done_at, due_date, archived_at from tasks");
    expect({ ...task.rows[0] }).toEqual({
      title: "할 일",
      done_at: null,
      due_date: null,
      archived_at: null,
    });
    await expect(
      client.execute({
        sql: "insert into tasks (id,title,created_at,updated_at) values ('t2','순서 없음',?,?)",
        args: [t, t],
      }),
    ).rejects.toThrow();
    client.close();
  });
});
