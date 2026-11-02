import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createRecommendedAreas } from "@/app/_actions/areas";
import { createDb, setDb } from "@/db/client";
import { archive, areas } from "@/lib/repo";

const dir = mkdtempSync(join(tmpdir(), "rb-areas-"));
const db = createDb({ url: `file:${join(dir, "test.db")}` });

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  setDb(db);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("createRecommendedAreas on a file database", () => {
  it("never creates duplicates when called twice at once", async () => {
    const [a, b] = await Promise.all([
      createRecommendedAreas(["건강", "학위"]),
      createRecommendedAreas(["건강", "커리어"]),
    ]);
    expect(a.ok && b.ok).toBe(true);
    const titles = (await areas.list()).map((x) => x.title).sort();
    expect(titles).toEqual(["건강", "커리어", "학위"]);
    const skipped = [a, b].flatMap((r) => (r.ok ? r.data.skipped : []));
    expect(skipped).toEqual([{ title: "건강", archived: false }]);
  });

  it("reports archived matches so the UI can point to the archive", async () => {
    const health = (await areas.list()).find((x) => x.title === "건강")!;
    await archive.archive({ type: "area", id: health.id });
    const res = await createRecommendedAreas(["건강", "연구 분야"]);
    expect(res).toMatchObject({
      ok: true,
      data: { skipped: [{ title: "건강", archived: true }] },
    });
    expect(res.ok && res.data.ids).toHaveLength(1);
  });
});
