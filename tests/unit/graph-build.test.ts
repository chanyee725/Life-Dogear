import { describe, expect, it } from "vitest";
import { buildGraph, buildLocalGraph, type GraphSource, type SourceItem } from "@/lib/graph/build";
import type { GraphData } from "@/lib/graph/types";

const item = (type: SourceItem["type"], id: string, extra: Partial<SourceItem> = {}): SourceItem => ({
  type,
  id,
  title: `${type} ${id}`,
  archived: false,
  ...extra,
});

/**
 * life ← year ← quarter ← project(area A) ; goal year → area A
 * project —link— paper ; paper —body— thought ; seminar alone ; archived thought linked to paper
 */
const SOURCE: GraphSource = {
  items: [
    item("goal", "life", { horizon: "life" }),
    item("goal", "year", { horizon: "2027", parentGoalId: "life", areaId: "A" }),
    item("goal", "q1", { horizon: "2027-Q1", parentGoalId: "year" }),
    item("area", "A"),
    item("area", "B"),
    item("project", "p", { goalId: "q1", areaId: "A" }),
    item("paper", "x"),
    item("thought", "t"),
    item("thought", "old", { archived: true }),
    item("seminar", "s"),
    item("review", "w45"),
  ],
  links: [
    { sourceType: "project", sourceId: "p", targetType: "paper", targetId: "x" },
    { sourceType: "thought", sourceId: "t", targetType: "paper", targetId: "x", via: "body" },
    { sourceType: "thought", sourceId: "old", targetType: "paper", targetId: "x" },
    { sourceType: "review", sourceId: "w45", targetType: "goal", targetId: "q1" },
    // Dangling link to a deleted item is ignored.
    { sourceType: "paper", sourceId: "x", targetType: "thought", targetId: "gone" },
  ],
  tags: [
    { id: "tg1", name: "NLP" },
    { id: "tg2", name: "건강" },
  ],
  itemTags: [
    { itemType: "paper", itemId: "x", tagId: "tg1" },
    { itemType: "seminar", itemId: "s", tagId: "tg1" },
    { itemType: "thought", itemId: "t", tagId: "tg2" },
  ],
};

const ids = (g: GraphData) => g.nodes.map((n) => n.id).sort();
const edges = (g: GraphData) => g.edges.map((e) => `${e.source}>${e.target}:${e.kind}`).sort();
const size = (g: GraphData, id: string) => g.nodes.find((n) => n.id === id)?.size;

describe("buildGraph", () => {
  it("builds membership, link and body edges; hides archived, topics and reviews by default", () => {
    const g = buildGraph(SOURCE);
    expect(ids(g)).toEqual([
      "area:A",
      "area:B",
      "goal:life",
      "goal:q1",
      "goal:year",
      "paper:x",
      "project:p",
      "seminar:s",
      "thought:t",
    ]);
    expect(edges(g)).toEqual([
      "goal:q1>goal:year:belongs",
      "goal:year>area:A:belongs",
      "goal:year>goal:life:belongs",
      "project:p>area:A:belongs",
      "project:p>goal:q1:belongs",
      "project:p>paper:x:link",
      "thought:t>paper:x:body",
    ]);
    expect(size(g, "project:p")).toBe(3);
    expect(size(g, "paper:x")).toBe(2);
    expect(size(g, "seminar:s")).toBe(0);
    expect(g.nodes.find((n) => n.id === "goal:year")).toMatchObject({
      horizon: "2027",
      areaId: "A",
      archived: false,
    });
  });

  it("shows archived items and reviews when asked", () => {
    const g = buildGraph(SOURCE, {
      archived: true,
      types: ["goal", "paper", "thought", "review"],
    });
    expect(ids(g)).toEqual([
      "goal:life",
      "goal:q1",
      "goal:year",
      "paper:x",
      "review:w45",
      "thought:old",
      "thought:t",
    ]);
    expect(g.nodes.find((n) => n.id === "thought:old")?.archived).toBe(true);
    expect(edges(g)).toContain("review:w45>goal:q1:link");
    // Hidden types do not leave dangling edges.
    expect(edges(g).some((e) => e.includes("project:"))).toBe(false);
  });

  it("adds topic nodes and dotted edges only when tags are requested", () => {
    const g = buildGraph(SOURCE, { types: ["paper", "seminar", "thought", "tag"] });
    expect(ids(g)).toContain("tag:tg1");
    expect(g.nodes.find((n) => n.id === "tag:tg1")).toMatchObject({ title: "NLP", size: 2 });
    expect(edges(g)).toEqual(
      expect.arrayContaining(["paper:x>tag:tg1:topic", "seminar:s>tag:tg1:topic"]),
    );
  });

  it("filters by tag, case-insensitively", () => {
    const g = buildGraph(SOURCE, { tag: "nlp" });
    expect(ids(g)).toEqual(["paper:x", "seminar:s"]);
    expect(g.edges).toEqual([]);
  });

  it("filters by area: the area, its members through goals, and their direct neighbours", () => {
    const g = buildGraph(SOURCE, { area: "A" });
    expect(ids(g)).toEqual([
      "area:A",
      "goal:life", // neighbour of year goal
      "goal:q1",
      "goal:year",
      "paper:x", // linked to project
      "project:p",
    ]);
    expect(buildGraph(SOURCE, { area: "B" }).nodes.map((n) => n.id)).toEqual(["area:B"]);
    expect(buildGraph(SOURCE, { area: "missing" }).nodes).toEqual([]);
  });

  it("orphans: items with no connections, ignoring topic edges", () => {
    const g = buildGraph(SOURCE, { orphans: true, types: ["area", "seminar", "paper", "tag"] });
    // area A loses its members (not requested); paper has only hidden-type links.
    expect(ids(g)).toEqual(["area:A", "area:B", "paper:x", "seminar:s"]);
    expect(g.edges).toEqual([]);
  });

  it("dedupes edges in either direction", () => {
    const g = buildGraph({
      items: [item("paper", "a"), item("paper", "b")],
      links: [
        { sourceType: "paper", sourceId: "a", targetType: "paper", targetId: "b" },
        { sourceType: "paper", sourceId: "b", targetType: "paper", targetId: "a" },
      ],
    });
    expect(g.edges).toHaveLength(1);
    expect(size(g, "paper:a")).toBe(1);
  });

  it("stays fast on thousands of nodes", () => {
    const items: SourceItem[] = [];
    const links: GraphSource["links"] = [];
    for (let i = 0; i < 5000; i++) items.push(item("paper", `n${i}`));
    for (let i = 1; i < 5000; i++) {
      links.push({
        sourceType: "paper",
        sourceId: `n${i}`,
        targetType: "paper",
        targetId: `n${Math.floor(i / 2)}`,
      });
    }
    const started = performance.now();
    const g = buildGraph({ items, links });
    buildLocalGraph({ items, links }, "paper:n1", 2);
    expect(g.edges).toHaveLength(4999);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("buildLocalGraph", () => {
  it("returns 1-step neighbours without archived ones", () => {
    const g = buildLocalGraph(SOURCE, "paper:x", 1);
    expect(ids(g)).toEqual(["paper:x", "project:p", "thought:t"]);
    expect(size(g, "paper:x")).toBe(2);
  });

  it("returns 2-step neighbours, including reviews", () => {
    const g = buildLocalGraph(SOURCE, "project:p", 2);
    expect(ids(g)).toEqual([
      "area:A",
      "goal:q1",
      "goal:year",
      "paper:x",
      "project:p",
      "review:w45",
      "thought:t",
    ]);
  });

  it("keeps an archived center and returns nothing for an unknown one", () => {
    expect(ids(buildLocalGraph(SOURCE, "thought:old", 1))).toEqual(["paper:x", "thought:old"]);
    expect(buildLocalGraph(SOURCE, "paper:none", 2)).toEqual({ nodes: [], edges: [] });
  });
});
