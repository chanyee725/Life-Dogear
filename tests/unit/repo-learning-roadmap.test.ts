import { beforeEach, describe, expect, it } from "vitest";
import { learningRoadmaps, roadmapNodes } from "@/db/schema";
import {
  assembleNodes,
  deleteRoadmap,
  getRoadmapTree,
  listRoadmaps,
  setNodeStatus,
  type RoadmapNodeRow,
  type RoadmapNodeView,
} from "@/lib/repo/learningRoadmap";
import { useFreshDb } from "./repo-helpers";

type Db = Awaited<ReturnType<typeof useFreshDb>>;
let db: Db;

beforeEach(async () => {
  db = await useFreshDb();
});

const T = "2026-11-01T00:00:00.000Z";

type Shape = string | [string, Shape[]];
const shape = (n: RoadmapNodeView): Shape =>
  n.children.length ? [`${n.kind}:${n.title}`, n.children.map(shape)] : `${n.kind}:${n.title}`;

async function seed(slug = "rust", updatedAt = T) {
  const id = `seed-${slug}`;
  await db.insert(learningRoadmaps).values({
    id,
    slug,
    title: `${slug} roadmap`,
    topic: slug,
    summary: "",
    createdAt: T,
    updatedAt,
  });
  const node = (
    nid: string,
    parentId: string | null,
    title: string,
    position: number,
    extra: Partial<typeof roadmapNodes.$inferInsert> = {},
  ) => ({
    id: `${id}-${nid}`,
    roadmapId: id,
    parentId: parentId && `${id}-${parentId}`,
    kind: parentId ? ("item" as const) : ("stage" as const),
    title,
    priority: parentId ? ("essential" as const) : null,
    position,
    createdAt: T,
    updatedAt: T,
    ...extra,
  });
  await db.insert(roadmapNodes).values([
    node("s2", null, "Advanced", 1),
    node("s1", null, "Basics", 0),
    node("i2", "s1", "Ownership", 1, { status: "done" }),
    node("i1", "s1", "Syntax", 0, {
      resources: [{ title: "Book", url: "https://example.com", kind: "book" }],
    }),
    node("c1", "i2", "Borrowing", 0, { priority: "optional" }),
    node("i3", "s2", "Async", 0, { status: "doing" }),
  ]);
  return id;
}

describe("getRoadmapTree", () => {
  it("nests stages → items → children in position order with progress", async () => {
    const id = await seed();
    const tree = await getRoadmapTree("rust");
    expect(tree).toMatchObject({ id, slug: "rust", progress: { done: 1, total: 4 } });
    expect(tree!.stages.map(shape)).toEqual([
      ["stage:Basics", ["item:Syntax", ["item:Ownership", ["item:Borrowing"]]]],
      ["stage:Advanced", ["item:Async"]],
    ]);
    const [basics, advanced] = tree!.stages;
    expect(basics).toMatchObject({
      priority: null,
      status: "todo",
      progress: { done: 1, total: 3 },
    });
    expect(basics!.children[0]!.resources).toEqual([
      { title: "Book", url: "https://example.com", kind: "book" },
    ]);
    expect(basics!.children[1]).toMatchObject({ status: "done", progress: { done: 0, total: 1 } });
    expect(basics!.children[1]!.children[0]).toMatchObject({ priority: "optional" });
    expect(advanced!.children[0]).toMatchObject({ status: "doing" });
  });

  it("returns null for an unknown slug", async () => {
    expect(await getRoadmapTree("nope")).toBeNull();
  });
});

describe("listRoadmaps", () => {
  it("lists by slug ascending regardless of updatedAt, with item progress", async () => {
    await seed("step-2", "2026-11-03T00:00:00.000Z");
    await seed("step-1", "2026-11-01T00:00:00.000Z");
    await db.insert(learningRoadmaps).values({
      id: "seed-empty",
      slug: "empty",
      title: "Empty",
      topic: "x",
      createdAt: T,
      updatedAt: T,
    });
    const list = await listRoadmaps();
    expect(list.map((r) => r.slug)).toEqual(["empty", "step-1", "step-2"]);
    expect(list[0]!.progress).toEqual({ done: 0, total: 0 });
    expect(list[1]!.progress).toEqual({ done: 1, total: 4 });
  });
});

describe("setNodeStatus / deleteRoadmap", () => {
  it("changes a node status and reports unknown nodes", async () => {
    const id = await seed();
    expect(await setNodeStatus(`${id}-i1`, "done")).toBe(true);
    expect((await getRoadmapTree("rust"))!.progress).toEqual({ done: 2, total: 4 });
    expect(await setNodeStatus("seed-missing", "done")).toBe(false);
  });

  it("deletes the roadmap with its nodes", async () => {
    const id = await seed();
    await seed("go");
    expect(await deleteRoadmap(id)).toBe(true);
    expect(await getRoadmapTree("rust")).toBeNull();
    expect((await db.select().from(roadmapNodes)).every((n) => n.roadmapId !== id)).toBe(true);
    expect(await deleteRoadmap(id)).toBe(false);
    expect((await listRoadmaps()).map((r) => r.slug)).toEqual(["go"]);
  });
});

describe("assembleNodes", () => {
  it("drops orphans and tolerates malformed resources", () => {
    const row = (id: string, parentId: string | null, resources: unknown): RoadmapNodeRow => ({
      id,
      parentId,
      kind: parentId ? "item" : "stage",
      title: id,
      description: "",
      priority: parentId ? "essential" : null,
      resources,
      status: "todo",
      position: 0,
    });
    const { stages, progress } = assembleNodes([
      row("s", null, "not json"),
      row("i", "s", [{ title: 1 }, { title: "ok", url: "https://x.y", kind: "doc" }]),
      row("o", "ghost", []),
    ]);
    expect(stages.map(shape)).toEqual([["stage:s", ["item:i"]]]);
    expect(stages[0]!.resources).toEqual([]);
    expect(stages[0]!.children[0]!.resources).toHaveLength(1);
    expect(progress).toEqual({ done: 0, total: 1 });
  });
});
