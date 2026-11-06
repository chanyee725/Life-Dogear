import { describe, expect, it } from "vitest";
import { itemLinkPath, stageCurvePath, stageRows, stageSway, SWAY } from "@/app/roadmap/layout";
import type { RoadmapNode } from "@/app/roadmap/model";

const node = (id: string, children: RoadmapNode[] = []): RoadmapNode => ({
  id,
  kind: children.length ? "stage" : "item",
  title: id,
  description: "",
  priority: null,
  resources: [],
  status: "todo",
  progress: { done: 0, total: 0 },
  children,
}) as unknown as RoadmapNode;

describe("stage sway and curve", () => {
  it("sways centre, right, centre, left", () => {
    expect([0, 1, 2, 3, 4].map((i) => stageSway(i, 10))).toEqual([0, 10, 0, -10, 0]);
    expect(stageSway(1)).toBe(SWAY);
  });

  it("curve runs from stage i centre at top to stage i+1 centre at bottom", () => {
    expect(stageCurvePath(0, { width: 200, height: 60, amplitude: 20 })).toBe(
      "M 100 0 C 100 30, 120 30, 120 60",
    );
    expect(stageCurvePath(2, { width: 200, height: 60, amplitude: 20 })).toBe(
      "M 100 0 C 100 30, 80 30, 80 60",
    );
  });

  it("item link starts at the stage edge on either side", () => {
    expect(itemLinkPath("left", 40, 10, 30)).toBe("M 40 10 C 20 10, 20 30, 0 30");
    expect(itemLinkPath("right", 40, 10, 30)).toBe("M 0 10 C 20 10, 20 30, 40 30");
  });
});

describe("stageRows", () => {
  const stages = [
    node("s1", [node("a"), node("b"), node("c")]),
    node("s2", [node("d")]),
    node("s3", []),
  ];

  it("splits items per stage and skips folded stages", () => {
    const rows = stageRows(stages, new Set(["s2"]));
    expect(rows[0].left.map((n) => n.id)).toEqual(["a", "b"]);
    expect(rows[0].right.map((n) => n.id)).toEqual(["c"]);
    expect(rows[1]).toMatchObject({ folded: true, left: [], right: [] });
    expect(rows[2]).toMatchObject({ folded: false, hasNext: false });
    expect(rows.map((r) => r.sway)).toEqual([0, SWAY, 0]);
  });

  it("memoises on stages + collapsed identity", () => {
    const set = new Set<string>();
    const a = stageRows(stages, set);
    expect(stageRows(stages, set)).toBe(a);
    expect(stageRows(stages, new Set<string>())).not.toBe(a);
  });

  it("handles ~1000 nodes quickly", () => {
    const big = Array.from({ length: 30 }, (_, s) =>
      node(`s${s}`, Array.from({ length: 32 }, (_, i) => node(`s${s}-${i}`))),
    );
    const t = performance.now();
    for (let i = 0; i < 100; i++) stageRows(big, new Set([`s${i % 30}`]));
    expect(performance.now() - t).toBeLessThan(200);
  });
});
