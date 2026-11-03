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

describe("migration 0003 (item stars)", () => {
  it("only creates the item_stars table", () => {
    expect(migrations[3]).toMatch(/^0003_/);
    const sql = readFileSync(join("drizzle", migrations[3]!), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/^CREATE TABLE `item_stars`/);
    expect(sql).not.toMatch(/ALTER TABLE|DROP |INSERT INTO|__new_/i);
  });

  it("keeps existing rows and lets items be starred once", async () => {
    dir = mkdtempSync(join(tmpdir(), "rb-mig3-"));
    const client = createClient({ url: `file:${join(dir, "m.db")}` });
    await client.execute("pragma foreign_keys = on");
    for (const m of migrations.slice(0, 3)) await apply(client, m);

    const t = "2026-11-01T00:00:00.000Z";
    await client.execute({
      sql: "insert into papers (id,title,created_at,updated_at) values ('p1','논문',?,?)",
      args: [t, t],
    });
    await client.execute({
      sql: "insert into links (id,source_type,source_id,target_type,target_id,created_at) values ('l1','paper','p1','paper','p1',?)",
      args: [t],
    });
    await apply(client, migrations[3]!);

    const paper = await client.execute("select id, title, created_at from papers");
    expect(paper.rows.map((r) => ({ ...r }))).toEqual([{ id: "p1", title: "논문", created_at: t }]);
    expect((await client.execute("select count(*) as n from links")).rows[0]!.n).toBe(1);

    await client.execute({
      sql: "insert into item_stars (item_type,item_id,created_at) values ('paper','p1',?)",
      args: [t],
    });
    await expect(
      client.execute({
        sql: "insert into item_stars (item_type,item_id,created_at) values ('paper','p1',?)",
        args: [t],
      }),
    ).rejects.toThrow();
    client.close();
  });
});
