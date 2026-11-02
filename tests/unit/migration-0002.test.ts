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

describe("migration 0002 (goals, reviews, graph)", () => {
  it("only adds tables and columns, so existing rows keep their values", async () => {
    const sql = readFileSync(join("drizzle", migrations[2]), "utf8");
    expect(migrations[2]).toMatch(/^0002_/);
    expect(sql).not.toMatch(/__new_|DROP TABLE|INSERT INTO/i);

    dir = mkdtempSync(join(tmpdir(), "rb-mig2-"));
    const client = createClient({ url: `file:${join(dir, "m.db")}` });
    await client.execute("pragma foreign_keys = on");
    await apply(client, migrations[0]);
    await apply(client, migrations[1]);

    const t = "2026-10-01T00:00:00.000Z";
    await client.batch([
      {
        sql: "insert into areas (id,title,created_at,updated_at) values ('ar1','연구 분야',?,?)",
        args: [t, t],
      },
      {
        sql: "insert into projects (id,title,kind,status,area_id,next_action,stage,body,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?)",
        args: ["p1", "연구", "research", "active", "ar1", "초안", "drafting", "본문", t, t],
      },
      {
        sql: "insert into thoughts (id,title,body,created_at,updated_at) values ('h1','생각','내용',?,?)",
        args: [t, t],
      },
      { sql: "insert into links values ('l1','thought','h1','project','p1',?)", args: [t] },
    ]);

    await apply(client, migrations[2]);

    expect((await client.execute("select * from projects")).rows[0]).toMatchObject({
      id: "p1",
      title: "연구",
      area_id: "ar1",
      next_action: "초안",
      stage: "drafting",
      body: "본문",
      goal_id: null,
    });
    expect((await client.execute("select * from links")).rows[0]).toMatchObject({
      id: "l1",
      source_type: "thought",
      target_id: "p1",
      created_at: t,
      via: "manual",
    });
    expect((await client.execute("select count(*) n from thoughts")).rows[0].n).toBe(1);

    // New tables work, including the life horizon (no period) and FK clean-up.
    await client.batch([
      {
        sql: "insert into goals (id,title,horizon,created_at,updated_at) values ('g1','좋은 연구자','life',?,?)",
        args: [t, t],
      },
      {
        sql: "insert into goals (id,title,horizon,period,parent_id,area_id,created_at,updated_at) values ('g2','1저자 논문','year','2027','g1','ar1',?,?)",
        args: [t, t],
      },
      { sql: "update projects set goal_id = 'g2'", args: [] },
      {
        sql: "insert into reviews (id,kind,period,title,created_at,updated_at) values ('r1','week','2026-W45','2026-W45 주간 회고',?,?)",
        args: [t, t],
      },
      {
        sql: "insert into graph_layout values ('goal','g1',1.5,-2,?)",
        args: [t],
      },
    ]);
    expect((await client.execute("select * from goals where id='g1'")).rows[0]).toMatchObject({
      period: null,
      status: "active",
      progress_mode: "auto",
      manual_progress: null,
      why: "",
    });
    expect(
      (await client.execute("select focus, goal_progress from reviews")).rows[0],
    ).toMatchObject({ focus: "[]", goal_progress: "{}" });
    await expect(
      client.execute(
        "insert into reviews (id,kind,period,title,created_at,updated_at) values ('r2','week','2026-W45','중복',?,?)",
        [t, t],
      ),
    ).rejects.toThrow();

    await client.execute("delete from goals where id='g1'");
    expect(
      (await client.execute("select parent_id from goals where id='g2'")).rows[0].parent_id,
    ).toBe(null);
    await client.execute("delete from goals where id='g2'");
    expect((await client.execute("select goal_id from projects")).rows[0].goal_id).toBe(null);
    client.close();
  });
});
