import { describe, expect, it } from "vitest";
import { grewBeyond, seedNear } from "@/components/graph/fit";

describe("graph fit after a filter change", () => {
  it("refits only when the graph grew by more than 15%", () => {
    const box = { x: [0, 100] as [number, number], y: [0, 100] as [number, number] };
    expect(grewBeyond(box, { x: [0, 110], y: [-5, 105] })).toBe(false);
    expect(grewBeyond(box, { x: [-10, 110], y: [0, 100] })).toBe(true);
    expect(grewBeyond(box, { x: [0, 100], y: [0, 130] })).toBe(true);
    // A smaller graph never triggers a refit.
    expect(grewBeyond(box, { x: [20, 40], y: [20, 40] })).toBe(false);
  });

  it("starts a new node beside a placed neighbour", () => {
    const placed = new Map([
      ["p", { x: 100, y: 50 }],
      ["unplaced", {}],
    ]);
    const links = [
      { source: "unplaced", target: "t" },
      { source: "p", target: "t" },
    ];
    const seed = seedNear("t", links, placed, () => 0)!;
    expect(seed.x).toBeCloseTo(130);
    expect(seed.y).toBeCloseTo(50);
    expect(seedNear("lonely", links, placed)).toBeNull();
  });
});
