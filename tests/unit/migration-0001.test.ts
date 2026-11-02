import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";

/** Runs one drizzle migration file statement by statement. */
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

describe("migration 0001 (PARA skeleton)", () => {
  it("keeps existing rows and backfills submitted projects", async () => {
    dir = mkdtempSync(join(tmpdir(), "rb-mig-"));
    const client = createClient({ url: `file:${join(dir, "m.db")}` });
    await apply(client, migrations[0]);

    const t = "2026-10-01T00:00:00.000Z";
    const u = "2026-10-20T00:00:00.000Z";
    await client.batch([
      {
        sql: "insert into projects (id,title,research_question,stage,start_date,due_date,body,created_at,updated_at) values (?,?,?,?,?,?,?,?,?)",
        args: ["p1", "진행 연구", "질문", "drafting", "2026-09-01", "2026-12-01", "본문", t, t],
      },
      {
        sql: "insert into projects (id,title,stage,created_at,updated_at) values (?,?,?,?,?)",
        args: ["p2", "제출한 연구", "submitted", t, u],
      },
      {
        sql: "insert into papers (id,title,authors,year,read_status,last_page,total_pages,last_read_at,body,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?)",
        args: ["a1", "논문", '["김가명"]', 2024, "reading", 4, 10, u, "메모", t, t],
      },
      {
        sql: "insert into seminars (id,title,date,kind,created_at,updated_at) values (?,?,?,?,?,?)",
        args: ["s1", "세미나", "2026-10-02", "lecture", t, t],
      },
      {
        sql: "insert into thoughts (id,title,kind,maturity,body,created_at,updated_at) values (?,?,?,?,?,?,?)",
        args: ["h1", "생각", "idea", "growing", "내용", t, t],
      },
      { sql: "insert into tags (id,name) values ('g1','NLP')", args: [] },
      { sql: "insert into item_tags values ('paper','a1','g1')", args: [] },
      {
        sql: "insert into links values ('l1','thought','h1','paper','a1',?)",
        args: [t],
      },
    ]);

    await apply(client, migrations[1]);

    const projects = (await client.execute("select * from projects order by id")).rows;
    expect(projects[0]).toMatchObject({
      id: "p1",
      title: "진행 연구",
      research_question: "질문",
      stage: "drafting",
      due_date: "2026-12-01",
      body: "본문",
      kind: "research",
      status: "active",
      area_id: null,
      next_action: "",
      completed_at: null,
      archived_at: null,
    });
    expect(projects[1]).toMatchObject({ id: "p2", status: "done", completed_at: u });

    expect((await client.execute("select * from papers")).rows[0]).toMatchObject({
      id: "a1",
      authors: '["김가명"]',
      last_page: 4,
      total_pages: 10,
      last_read_at: u,
      body: "메모",
      archived_at: null,
    });
    expect((await client.execute("select kind, archived_at from seminars")).rows[0]).toMatchObject({
      kind: "lecture",
      archived_at: null,
    });
    expect((await client.execute("select maturity from thoughts")).rows[0]).toMatchObject({
      maturity: "growing",
    });
    expect((await client.execute("select count(*) n from item_tags")).rows[0].n).toBe(1);
    expect((await client.execute("select count(*) n from links")).rows[0].n).toBe(1);
    expect((await client.execute("select count(*) n from areas")).rows[0].n).toBe(0);
    client.close();
  });
});
