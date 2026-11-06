import { describe, expect, it } from "vitest";
import {
  collapseAll,
  collapseEverything,
  defaultCollapsed,
  expandAll,
  setCollapsed,
  toggleCollapsed,
} from "@/app/roadmap/collapse";

describe("roadmap collapse set", () => {
  it("toggle folds then unfolds an id", () => {
    const folded = toggleCollapsed(new Set(), "s1");
    expect([...folded]).toEqual(["s1"]);
    expect([...toggleCollapsed(folded, "s1")]).toEqual([]);
  });

  it("toggle returns a new set and leaves the input untouched", () => {
    const before = new Set(["s1"]);
    const after = toggleCollapsed(before, "item-a");
    expect(after).not.toBe(before);
    expect([...before]).toEqual(["s1"]);
    expect(new Set(after)).toEqual(new Set(["s1", "item-a"]));
  });

  it("stages and items share one set", () => {
    let set = toggleCollapsed(new Set(), "stage-1");
    set = toggleCollapsed(set, "item-1");
    expect(set.has("stage-1") && set.has("item-1")).toBe(true);
  });

  it("collapseAll folds every stage, expandAll clears", () => {
    expect(new Set(collapseAll(["s1", "s2"]))).toEqual(new Set(["s1", "s2"]));
    expect(collapseAll([]).size).toBe(0);
    expect(expandAll().size).toBe(0);
  });
});

describe("tree default / collapse everything", () => {
  const leaf = (id: string) => ({ id, children: [] });
  const stages = [
    { id: "s1", children: [{ id: "a", children: [{ id: "a1", children: [leaf("a11")] }] }, leaf("b")] },
    { id: "s2", children: [] },
  ];

  it("default folds item branches only, stages stay open", () => {
    expect(new Set(defaultCollapsed(stages))).toEqual(new Set(["a", "a1"]));
  });

  it("collapseEverything folds every node with children, stages included", () => {
    expect(new Set(collapseEverything(stages))).toEqual(new Set(["s1", "a", "a1"]));
  });

  it("setCollapsed is a no-op when already in that state", () => {
    const set = new Set(["a"]);
    expect(setCollapsed(set, "a", true)).toBe(set);
    expect([...setCollapsed(set, "a", false)]).toEqual([]);
  });
});
