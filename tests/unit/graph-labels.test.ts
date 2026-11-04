import { describe, expect, it } from "vitest";
import { byLabelPriority, fitLabel } from "@/components/graph/model";

const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

describe("neighbour labels avoid overlaps", () => {
  it("draws a label that touches nothing", () => {
    expect(fitLabel([box(0, 0, 10, 5)], [box(20, 0, 30, 5)])).toBe(0);
    expect(fitLabel([box(0, 0, 10, 5)], [])).toBe(0);
  });

  it("falls back to the short text, then hides", () => {
    const placed = [box(25, 0, 40, 5)];
    // Long text reaches into the drawn label; the short one does not.
    expect(fitLabel([box(0, 0, 30, 5), box(5, 0, 20, 5)], placed)).toBe(1);
    // Both overlap: hidden.
    expect(fitLabel([box(0, 0, 30, 5), box(20, 0, 30, 5)], placed)).toBe(-1);
  });

  it("keeps a margin between labels", () => {
    const placed = [box(11, 0, 20, 5)];
    expect(fitLabel([box(0, 0, 10, 5)], placed)).toBe(0);
    expect(fitLabel([box(0, 0, 10, 5)], placed, 2)).toBe(-1);
  });

  it("orders neighbours goal > area > project > rest > task, bigger first", () => {
    const nodes = [
      { id: "t", type: "task" as const, size: 9 },
      { id: "n1", type: "note" as const, size: 1 },
      { id: "n2", type: "note" as const, size: 5 },
      { id: "g", type: "goal" as const, size: 0 },
      { id: "a", type: "area" as const, size: 0 },
    ];
    expect(byLabelPriority(nodes).map((n) => n.id)).toEqual(["g", "a", "n2", "n1", "t"]);
  });
});
