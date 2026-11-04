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

describe("migration 0007 (notes)", () => {
  it("only creates the notes table and its indexes", () => {
    expect(migrations[7]).toMatch(/^0007_/);
    const sql = readFileSync(join("drizzle", migrations[7]!), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(3);
    expect(statements[0]).toMatch(/^CREATE TABLE `notes`/);
    expect(statements.slice(1).every((s) => /^CREATE INDEX `notes_\w+` ON `notes`/.test(s))).toBe(
      true,
    );
    expect(sql).not.toMatch(/ALTER TABLE|DROP |INSERT INTO|^\s*UPDATE |__new_/im);
  });

  it("keeps existing rows, accepts notes and clears the area on area delete", async () => {
    dir = mkdtempSync(join(tmpdir(), "rb-mig7-"));
    const client = createClient({ url: `file:${join(dir, "m.db")}` });
    await client.execute("pragma foreign_keys = on");
    for (const m of migrations.slice(0, 7)) await apply(client, m);

    const t = "2026-11-04T00:00:00.000Z";
    await client.execute({
      sql: "insert into areas (id,title,created_at,updated_at) values ('a1','영역',?,?)",
      args: [t, t],
    });
    await client.execute({
      sql: "insert into thoughts (id,title,created_at,updated_at) values ('t1','생각',?,?)",
      args: [t, t],
    });
    await apply(client, migrations[7]!);

    expect((await client.execute("select count(*) as n from areas")).rows[0]!.n).toBe(1);
    expect((await client.execute("select count(*) as n from thoughts")).rows[0]!.n).toBe(1);

    await client.execute({
      sql: "insert into notes (id,title,area_id,created_at,updated_at) values ('n1','노트','a1',?,?)",
      args: [t, t],
    });
    const note = await client.execute(
      "select body, source_kind, source_title, source_url, area_id, archived_at from notes",
    );
    expect({ ...note.rows[0] }).toEqual({
      body: "",
      source_kind: null,
      source_title: null,
      source_url: null,
      area_id: "a1",
      archived_at: null,
    });
    await client.execute("delete from areas where id = 'a1'");
    expect((await client.execute("select area_id from notes")).rows[0]!.area_id).toBeNull();
    await expect(
      client.execute({
        sql: "insert into notes (id,created_at,updated_at) values ('n2',?,?)",
        args: [t, t],
      }),
    ).rejects.toThrow();
    client.close();
  });
});
