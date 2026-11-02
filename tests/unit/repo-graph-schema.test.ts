import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { goals as goalsTable, links as linksTable, reviews as reviewsTable } from "@/db/schema";
import { ITEM_ROUTE, ITEM_TYPE } from "@/lib/enums";
import { archive, items, links, thoughts } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

let db: Awaited<ReturnType<typeof useFreshDb>>;
const t = "2026-11-03T00:00:00.000Z";

beforeEach(async () => {
  db = await useFreshDb();
  await db.insert(goalsTable).values({
    id: "g1",
    title: "좋은 연구자가 된다",
    horizon: "life",
    createdAt: t,
    updatedAt: t,
  });
  await db.insert(reviewsTable).values({
    id: "r1",
    kind: "week",
    period: "2026-W45",
    title: "2026-W45 주간 회고",
    createdAt: t,
    updatedAt: t,
  });
});

const G = { type: "goal" as const, id: "g1" };
const R = { type: "review" as const, id: "r1" };

describe("goal and review item types", () => {
  it("have labels, distinct tones and routes", () => {
    expect(ITEM_TYPE.label("goal")).toBe("목표");
    expect(ITEM_TYPE.tone("goal")).toBe("red");
    expect(ITEM_TYPE.tone("review")).toBe("gray");
    const tones = ITEM_TYPE.options.map((o) => o.tone);
    expect(new Set(tones).size).toBe(tones.length);
    expect(ITEM_ROUTE.goal).toBe("/goals");
    expect(ITEM_ROUTE.review).toBe("/reviews");
  });

  it("work with exists, heads, title search, links and archive", async () => {
    expect(await items.exists(G)).toBe(true);
    expect(await items.exists(R)).toBe(true);
    expect((await items.getTitles([G, R])).get("review:r1")).toBe("2026-W45 주간 회고");
    expect((await items.searchTitles("연구자")).map((s) => s.ref)).toEqual([G]);
    expect((await items.searchTitles("회고")).map((s) => s.ref)).toEqual([R]);

    await links.link(R, G);
    expect(await links.listConnected(G)).toEqual([
      { ref: R, type: "review", title: "2026-W45 주간 회고", archived: false },
    ]);

    expect(await archive.archive(G)).toBe(true);
    expect(await items.searchTitles("연구자")).toEqual([]);
    expect((await archive.listArchived()).map((a) => a.ref)).toEqual([G]);
  });
});

describe("links.via", () => {
  it("defaults to manual, and a hand link promotes an existing body link", async () => {
    const th = await thoughts.create({ title: "생각" });
    const T = { type: "thought" as const, id: th.id };

    const manual = await links.link(T, R);
    expect(manual.via).toBe("manual");

    await db.insert(linksTable).values({
      id: "lb",
      sourceType: "thought",
      sourceId: th.id,
      targetType: "goal",
      targetId: "g1",
      via: "body",
      createdAt: t,
    });
    // Linking by hand in either direction keeps one row and makes it manual.
    const promoted = await links.link(G, T);
    expect(promoted).toMatchObject({ id: "lb", via: "manual" });
    const [row] = await db.select().from(linksTable).where(eq(linksTable.id, "lb"));
    expect(row.via).toBe("manual");
    expect(await db.select().from(linksTable)).toHaveLength(2);
  });
});
