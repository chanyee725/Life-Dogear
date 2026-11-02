import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, setDb } from "@/db/client";
import { links as linksTable } from "@/db/schema";
import { links, papers, projects, tags, thoughts } from "@/lib/repo";

// A real file database: concurrent writes on it used to fail with SQLITE_BUSY.
const dir = mkdtempSync(join(tmpdir(), "rb-repo-"));
const db = createDb({ url: `file:${join(dir, "test.db")}` });

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  setDb(db);
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("concurrent writes on a file database", () => {
  it("handles many simultaneous saveProgress calls", async () => {
    const p = await papers.create({ title: "논문" });
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        papers.saveProgress(p.id, { page: i + 1, scroll: 0.5, totalPages: 40 }),
      ),
    );
    expect(results.every(Boolean)).toBe(true);
    expect(await papers.get(p.id)).toMatchObject({ readStatus: "reading", lastPage: 30 });
  });

  it("links the same pair from both sides at once into a single link", async () => {
    const a = await thoughts.create({ title: "A" });
    const b = await projects.create({ title: "B" });
    const A = { type: "thought" as const, id: a.id };
    const B = { type: "project" as const, id: b.id };
    const [x, y] = await Promise.all([links.link(A, B), links.link(B, A)]);
    expect(x.id).toBe(y.id);
    expect(await db.select().from(linksTable)).toHaveLength(1);
  });

  it("mixes creates, updates, tags, reads and deletes concurrently", async () => {
    const created = await Promise.all(
      Array.from({ length: 10 }, (_, i) => thoughts.create({ title: `T${i}`, tags: ["동시"] })),
    );
    await Promise.all([
      ...created.map((t) => thoughts.update(t.id, { maturity: "growing" })),
      ...created.map((t) => thoughts.get(t.id)),
      ...created.slice(0, 3).map((t) => thoughts.remove(t.id)),
      tags.listAll(),
    ]);
    expect((await thoughts.list({ tag: "동시" })).length).toBe(7);
  });
});
