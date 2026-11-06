import { describe, expect, it } from "vitest";
import { collapseAll, expandAll, toggleCollapsed } from "@/app/roadmap/collapse";

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
