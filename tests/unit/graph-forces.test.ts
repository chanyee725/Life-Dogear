import { describe, expect, it } from "vitest";
import {
  forceAxis,
  forceCollideGrid,
  forceRadial,
  type ForceNode,
} from "@/components/graph/forces";

type N = ForceNode & { col: number };

describe("forceAxis", () => {
  it("pulls unpinned nodes toward their target and leaves pinned ones alone", () => {
    const nodes: N[] = [
      { x: 0, y: 0, vx: 0, vy: 0, col: 280 },
      { x: 0, y: 0, vx: 0, vy: 0, fx: 0, col: 280 },
    ];
    const f = forceAxis<N>(
      "x",
      (n) => n.col,
      () => 1,
    );
    f.initialize(nodes);
    f(0.5);
    expect(nodes[0]!.vx).toBe(140);
    expect(nodes[1]!.vx).toBe(0);
  });

  it("skips nodes with no target", () => {
    const nodes: N[] = [{ x: 0, y: 10, vy: 0, col: 0 }];
    const f = forceAxis<N>(
      "y",
      () => null,
      () => 1,
    );
    f.initialize(nodes);
    f(1);
    expect(nodes[0]!.vy).toBe(0);
  });
});

describe("forceCollideGrid", () => {
  it("pushes overlapping nodes apart symmetrically", () => {
    const nodes: N[] = [
      { x: 0, y: 0, vx: 0, vy: 0, col: 0 },
      { x: 4, y: 0, vx: 0, vy: 0, col: 0 },
    ];
    const f = forceCollideGrid<N>(() => 5, 1);
    f.initialize(nodes);
    f(1);
    expect(nodes[0]!.vx).toBeLessThan(0);
    expect(nodes[1]!.vx).toBeGreaterThan(0);
    expect(nodes[0]!.vx! + nodes[1]!.vx!).toBeCloseTo(0);
  });

  it("separates coincident nodes and ignores far ones", () => {
    const nodes: N[] = [
      { x: 0, y: 0, vx: 0, vy: 0, col: 0 },
      { x: 0, y: 0, vx: 0, vy: 0, col: 0 },
      { x: 500, y: 500, vx: 0, vy: 0, col: 0 },
    ];
    const f = forceCollideGrid<N>(() => 5);
    f.initialize(nodes);
    f(1);
    expect(Math.hypot(nodes[0]!.vx!, nodes[0]!.vy!)).toBeGreaterThan(0);
    expect(nodes[2]!.vx).toBe(0);
  });

  it("stays fast with thousands of nodes", () => {
    const nodes: N[] = Array.from({ length: 5000 }, (_, i) => ({
      x: (i % 100) * 7,
      y: Math.floor(i / 100) * 7,
      vx: 0,
      vy: 0,
      col: 0,
    }));
    const f = forceCollideGrid<N>(() => 5);
    f.initialize(nodes);
    const t = performance.now();
    f(1);
    expect(performance.now() - t).toBeLessThan(500);
  });
});

describe("forceRadial", () => {
  it("pushes nodes out to / in to the ring and skips pinned or opted-out nodes", () => {
    const nodes: N[] = [
      { x: 10, y: 0, vx: 0, vy: 0, col: 0 }, // inside a 100 ring → pushed out
      { x: 0, y: 200, vx: 0, vy: 0, col: 0 }, // outside → pulled in
      { x: 10, y: 0, vx: 0, vy: 0, fx: 10, col: 0 },
      { x: 10, y: 0, vx: 0, vy: 0, col: -1 },
    ];
    const f = forceRadial<N>(
      (n) => (n.col < 0 ? null : 100),
      () => 0.5,
    );
    f.initialize(nodes);
    f(1);
    expect(nodes[0]!.vx).toBeCloseTo(45);
    expect(nodes[1]!.vy).toBeCloseTo(-50);
    expect(nodes[2]!.vx).toBe(0);
    expect(nodes[3]!.vx).toBe(0);
  });
});
