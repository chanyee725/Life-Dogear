import { describe, expect, it } from "vitest";
import {
  armRefit,
  DISARMED,
  fitTransform,
  grewBeyond,
  noteTransform,
  overflowsArea,
  refitOnStop,
  seedNear,
} from "@/components/graph/fit";

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

describe("fitTransform: nodes and their labels", () => {
  const item = (x: number, y: number, labelW = 0, labelH = 0) => ({
    x,
    y,
    side: 5,
    top: 5,
    bottom: 5,
    labelW,
    labelH,
  });
  const area = { width: 400, height: 300, pad: 20, minZoom: 0.2, maxZoom: 2.5 };

  it("keeps the bottom row's labels on screen", () => {
    const items = [item(0, 0, 40, 20), item(0, 200, 40, 20)];
    const t = fitTransform(items, area)!;
    // Without labels the zoom would be (300 − 40) / 210; the label takes 20px of that.
    expect(t.k).toBeCloseTo((300 - 40 - 20) / 210, 3);
    expect(overflowsArea(items, t, area)).toBe(false);
    // Bottom label edge sits exactly on the bottom padding.
    const bottomPx = (205 - t.cy) * t.k + 150 + 20;
    expect(bottomPx).toBeCloseTo(300 - 20, 1);
  });

  it("makes room for wide labels at the left and right edges", () => {
    const items = [item(-100, 0, 160, 18), item(100, 0, 160, 18)];
    const t = fitTransform(items, area)!;
    expect(overflowsArea(items, t, area)).toBe(false);
    // 160px labels at both ends: the 200-unit span gets 360 − 160 px.
    expect(t.k).toBeCloseTo((400 - 40 - 160) / 200, 3);
  });

  it("centres in the free area between overlays and caps the zoom", () => {
    const one = [item(10, 10)];
    const t = fitTransform(one, { ...area, left: 100 })!;
    expect(t.k).toBe(2.5);
    const screenX = (10 - t.cx) * t.k + 200;
    expect(screenX).toBeCloseTo(100 + 150, 3);
    expect(fitTransform([], area)).toBeNull();
  });

  it("detects a drawing that drifted off screen after the fit", () => {
    const items = [item(0, 0, 40, 20), item(0, 200, 40, 20)];
    const t = fitTransform(items, area)!;
    const drifted = items.map((n) => ({ ...n, y: n.y + 60 }));
    expect(overflowsArea(drifted, t, area)).toBe(true);
  });
});

describe("refit on settle only right after an automatic fit", () => {
  const off = () => true;
  const on = () => false;

  it("refits on the first stop after the fit when the drawing drifted off screen", () => {
    const g = armRefit(1000, 400);
    expect(refitOnStop(g, off).refit).toBe(true);
    expect(refitOnStop(g, on).refit).toBe(false);
  });

  it("does not refit on later stops (e.g. after dragging a node while zoomed in)", () => {
    const first = refitOnStop(armRefit(1000, 0), on);
    expect(refitOnStop(first.next, off).refit).toBe(false);
    expect(refitOnStop(DISARMED, off).refit).toBe(false);
  });

  it("does not refit after the user zoomed or panned", () => {
    const g = armRefit(1000, 400);
    // Zoom events from the fit's own animation keep it armed…
    expect(noteTransform(g, 1300).armed).toBe(true);
    // …the user's afterwards disarm it.
    const moved = noteTransform(g, 2000);
    expect(refitOnStop(moved, off).refit).toBe(false);
  });

  it("checks the screen only when armed", () => {
    let checked = 0;
    refitOnStop(DISARMED, () => (checked++, true));
    expect(checked).toBe(0);
  });
});
