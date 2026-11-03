import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

const statements = (file: string) =>
  readFileSync(join("drizzle", file), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

describe("migration 0006 (two seminar kinds)", () => {
  it("maps 학회 발표 to 발표 and every other old kind to 세미나", async () => {
    dir = mkdtempSync(join(tmpdir(), "rb-mig6-"));
    const client = createClient({ url: `file:${join(dir, "m.db")}` });
    await client.execute("create table seminars (id text primary key, kind text not null)");
    const old = ["seminar", "conference_talk", "lecture", "webinar", "other", "talk"];
    await client.batch(
      old.map((kind, i) => ({ sql: "insert into seminars values (?, ?)", args: [`s${i}`, kind] })),
    );
    for (const sql of statements("0006_seminar_two_kinds.sql")) await client.execute(sql);
    const rows = (await client.execute("select id, kind from seminars order by id")).rows;
    expect(rows.map((r) => r.kind)).toEqual([
      "seminar",
      "talk",
      "seminar",
      "seminar",
      "seminar",
      "talk",
    ]);
    client.close();
  });
});
