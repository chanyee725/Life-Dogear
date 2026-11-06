import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { learningRoadmaps, roadmapNodes } from "@/db/schema";
import { importRoadmap, parseRoadmapJson } from "../../scripts/roadmap-import";
import { useFreshDb } from "./repo-helpers";

let db: Db;

beforeEach(async () => {
  db = await useFreshDb();
});

function sample() {
  return {
    slug: "rust-basics",
    title: "Rust 기초",
    topic: "Rust",
    summary: "처음 배우는 Rust",
    stages: [
      {
        title: "입문",
        description: "문법",
        items: [
          {
            title: "소유권",
            priority: "essential",
            description: "ownership",
            resources: [{ title: "The Book", url: "https://doc.rust-lang.org/book/", kind: "book" }],
            children: [
              {
                title: "빌림",
                priority: "recommended",
                description: "borrowing",
                resources: [],
                children: [],
              },
            ],
          },
          { title: "패턴", priority: "optional", description: "", resources: [], children: [] },
        ],
      },
      { title: "심화", description: "", items: [] },
    ],
  };
}

async function nodes() {
  return db.select().from(roadmapNodes).orderBy(asc(roadmapNodes.position));
}

async function nodeByTitle(title: string) {
  const [row] = await db.select().from(roadmapNodes).where(eq(roadmapNodes.title, title));
  return row;
}

describe("roadmap import", () => {
  it("imports a new roadmap with every node as todo", async () => {
    const result = await importRoadmap(db, parseRoadmapJson(JSON.stringify(sample())));
    expect(result).toMatchObject({ created: true, added: 6, updated: 0, removed: 0 });

    const [roadmap] = await db.select().from(learningRoadmaps);
    expect(roadmap).toMatchObject({ slug: "rust-basics", title: "Rust 기초", topic: "Rust" });

    const all = await nodes();
    expect(all).toHaveLength(6);
    expect(all.every((n) => n.status === "todo" && n.roadmapId === roadmap!.id)).toBe(true);

    const stage = await nodeByTitle("입문");
    const ownership = await nodeByTitle("소유권");
    const borrowing = await nodeByTitle("빌림");
    expect(stage).toMatchObject({ kind: "stage", parentId: null, position: 0 });
    expect(ownership).toMatchObject({ kind: "item", parentId: stage!.id, priority: "essential" });
    expect(borrowing).toMatchObject({ kind: "item", parentId: ownership!.id, position: 0 });
    expect(JSON.stringify(ownership!.resources)).toContain("doc.rust-lang.org");
    expect((await nodeByTitle("패턴"))!.position).toBe(1);
    expect((await nodeByTitle("심화"))!.position).toBe(1);
  });

  it("updates the same slug: keeps status by path, overwrites text, drops missing nodes", async () => {
    await importRoadmap(db, parseRoadmapJson(JSON.stringify(sample())));
    const ownership = await nodeByTitle("소유권");
    const borrowing = await nodeByTitle("빌림");
    await db.update(roadmapNodes).set({ status: "done" }).where(eq(roadmapNodes.id, ownership!.id));
    await db.update(roadmapNodes).set({ status: "doing" }).where(eq(roadmapNodes.id, borrowing!.id));

    const next = sample();
    next.title = "Rust 기초 (개정)";
    const item = next.stages[0]!.items[0]!;
    item.description = "ownership v2";
    item.resources = [{ title: "Rustlings", url: "https://github.com/rust-lang/rustlings", kind: "code" }];
    next.stages[0]!.items[1] = {
      title: "트레잇",
      priority: "essential",
      description: "",
      resources: [],
      children: [],
    };
    next.stages.pop();

    const result = await importRoadmap(db, parseRoadmapJson(JSON.stringify(next)));
    expect(result).toMatchObject({ created: false, added: 1, updated: 3, removed: 2 });

    const roadmaps = await db.select().from(learningRoadmaps);
    expect(roadmaps).toHaveLength(1);
    expect(roadmaps[0]!.title).toBe("Rust 기초 (개정)");

    const after = await nodeByTitle("소유권");
    expect(after).toMatchObject({ id: ownership!.id, status: "done", description: "ownership v2" });
    expect(JSON.stringify(after!.resources)).toContain("rustlings");
    expect((await nodeByTitle("빌림"))!.status).toBe("doing");
    expect((await nodeByTitle("트레잇"))!.status).toBe("todo");
    expect(await nodeByTitle("패턴")).toBeUndefined();
    expect(await nodeByTitle("심화")).toBeUndefined();
    expect(await nodes()).toHaveLength(4);
  });

  it("rejects malformed or off-contract JSON", async () => {
    expect(() => parseRoadmapJson("{not json")).toThrow();
    const bad = sample();
    (bad.stages[0]!.items[0]!.resources[0] as { url: string }).url = "ftp://example.com";
    expect(() => parseRoadmapJson(JSON.stringify(bad))).toThrow();
    const noSlug: Partial<ReturnType<typeof sample>> = sample();
    delete noSlug.slug;
    expect(() => parseRoadmapJson(JSON.stringify(noSlug))).toThrow();
    expect(await db.select().from(learningRoadmaps)).toHaveLength(0);
  });
});
