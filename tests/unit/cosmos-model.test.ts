import { describe, expect, it } from "vitest";
import {
  cosmosAlpha,
  cosmosLabelZoom,
  boxesOverlap,
  boxHitsCircle,
  cosmosRadius,
  freeArea,
  grewBeyond,
  galaxyAnchors,
  galaxyColor,
  glowFor,
  isSun,
  makeStars,
  nebulae,
  placeLabel,
  starCount,
  sunPositions,
  sunRadius,
  wrap,
} from "@/components/graph/cosmos-model";
import { COSMOS_THEME, GALAXY } from "@/components/graph/graph-theme";

describe("node size, brightness, glow (3.2–3.3)", () => {
  it("scales the base radius by 0.85 + 0.9·s, capped at 18", () => {
    expect(cosmosRadius({ type: "paper" }, 0, 10)).toBeCloseTo(3.4);
    expect(cosmosRadius({ type: "paper" }, 1, 10)).toBeCloseTo(7);
    expect(cosmosRadius({ type: "goal", horizon: "life" }, 1, 10)).toBe(15.75);
    expect(cosmosRadius({ type: "area" }, 1, 10)).toBeCloseTo(10.5);
    expect(cosmosRadius({ type: "review" }, 1, 10)).toBe(3.5);
    expect(cosmosRadius({ type: "project" }, 0, 2000)).toBeCloseTo(4 * 0.85);
    expect(cosmosRadius({ type: "goal", horizon: "life" }, 5, 10)).toBe(18);
  });

  it("brightens from 0.75 to 1, fixed for reviews and topics", () => {
    expect(cosmosAlpha({ type: "paper" }, 0)).toBe(0.75);
    expect(cosmosAlpha({ type: "paper" }, 1)).toBe(1);
    expect(cosmosAlpha({ type: "tag" }, 1)).toBe(0.75);
  });

  it("glows from s ≥ 0.15 (s ≥ 0.5 on large graphs)", () => {
    expect(glowFor(4, 0.1, 10)).toBeNull();
    expect(glowFor(4, 1, 10)).toEqual({ radius: 4 * 3.5, alpha: 0.4 });
    expect(glowFor(4, 0.4, 2000)).toBeNull();
    expect(glowFor(4, 0.5, 2000)?.alpha).toBeCloseTo(0.25);
  });
});

describe("suns (3.4)", () => {
  it("only active life goals", () => {
    expect(isSun({ type: "goal", horizon: "life" })).toBe(true);
    expect(isSun({ type: "goal", horizon: "life" }, "achieved")).toBe(false);
    expect(isSun({ type: "goal", horizon: "year" })).toBe(false);
  });

  it("sit at the centre, on 50g (2–3) or 80g (4+) circles", () => {
    expect(sunPositions(1)).toEqual([{ x: 0, y: 0 }]);
    const two = sunPositions(2);
    expect(two[0]!.y).toBeCloseTo(-50);
    expect(two[1]!.y).toBeCloseTo(50);
    expect(Math.hypot(sunPositions(4)[1]!.x, sunPositions(4)[1]!.y)).toBeCloseTo(80);
    expect(sunRadius(3)).toBe(14);
    expect(sunRadius(4)).toBe(12);
    expect(sunPositions(0)).toEqual([]);
  });
});

describe("galaxies (1.1, 4)", () => {
  const order = new Map([
    ["a", 0],
    ["b", 1],
    ["m", 12],
  ]);
  it("colors by area order, cycling after 12, neutral otherwise", () => {
    expect(galaxyColor("a", order)).toBe(GALAXY[0]);
    expect(galaxyColor("b", order)).toBe(GALAXY[1]);
    expect(galaxyColor("m", order)).toBe(GALAXY[0]);
    expect(galaxyColor(null, order)).toBe(COSMOS_THEME.neutral);
    expect(galaxyColor("zzz", order)).toBe(COSMOS_THEME.neutral);
  });

  it("puts anchors on a 220 + 30N circle from the top, clockwise", () => {
    expect(galaxyAnchors(1)).toEqual([{ x: 250, y: 0 }]);
    const four = galaxyAnchors(4);
    expect(four[0]!.x).toBeCloseTo(0);
    expect(four[0]!.y).toBeCloseTo(-340);
    expect(four[1]!.x).toBeCloseTo(340); // clockwise on screen (y down)
    expect(galaxyAnchors(0)).toEqual([]);
  });

  it("all 12 palette colors differ", () => {
    expect(new Set(GALAXY).size).toBe(12);
  });
});

describe("labels (9)", () => {
  it("lets s ≥ 0.6 nodes show as early as goals and areas", () => {
    expect(cosmosLabelZoom({ type: "paper" }, 0.6, 10)).toBe(0.8);
    expect(cosmosLabelZoom({ type: "paper" }, 0.6, 400)).toBe(1.3);
    expect(cosmosLabelZoom({ type: "paper" }, 0.2, 10)).toBe(2);
  });
});

describe("nebulae (2.1)", () => {
  it("one per galaxy with 3+ nodes, radius farthest + 40 (min 80); off when large", () => {
    const pts = [
      { x: 0, y: 0, galaxy: "a" },
      { x: 100, y: 0, galaxy: "a" },
      { x: 50, y: 0, galaxy: "a" },
      { x: 0, y: 0, galaxy: "b" },
      { x: 5, y: 5, galaxy: null },
    ];
    expect(nebulae(pts, 10)).toEqual([{ galaxy: "a", x: 50, y: 0, radius: 90 }]);
    expect(
      nebulae(
        pts.slice(0, 3).map((p) => ({ ...p, x: p.x / 10 })),
        10,
      )[0]!.radius,
    ).toBe(80);
    expect(nebulae(pts, 2000)).toEqual([]);
  });
});

describe("background stars (2.2)", () => {
  it("uses 0.12 per 1,000 px², within 60..400", () => {
    expect(starCount(1440, 900)).toBe(156);
    expect(starCount(100, 100)).toBe(60);
    expect(starCount(10000, 10000)).toBe(400);
  });

  it("is the same sky for the same seed and size, with the given mix", () => {
    const a = makeStars(1440, 900);
    expect(makeStars(1440, 900)).toEqual(a);
    for (const s of a) {
      expect(s.r).toBeGreaterThanOrEqual(0.5);
      expect(s.r).toBeLessThanOrEqual(1.7);
      expect(s.alpha).toBeGreaterThanOrEqual(0.2);
      expect(s.alpha).toBeLessThanOrEqual(0.85);
      expect(s.x).toBeLessThan(1440);
    }
    const many = makeStars(10000, 10000, 7);
    const share = (pred: (s: (typeof many)[number]) => boolean) =>
      many.filter(pred).length / many.length;
    expect(share((s) => s.color === COSMOS_THEME.starWhite)).toBeGreaterThan(0.6);
    expect(share((s) => s.twinkle !== null)).toBeLessThan(0.2);
  });

  it("wraps coordinates", () => {
    expect(wrap(-5, 100)).toBe(95);
    expect(wrap(105, 100)).toBe(5);
  });
});

describe("free area (4.1)", () => {
  it("subtracts the expanded panel on the left and the open preview on the right", () => {
    expect(freeArea(1200, true, true)).toEqual({ left: 320, right: 352 });
    expect(freeArea(1200, false, true)).toEqual({ left: 0, right: 352 });
    expect(freeArea(1200, true, false)).toEqual({ left: 320, right: 0 });
  });

  it("drops the left inset when the free width would be under 320px", () => {
    expect(freeArea(900, true, true)).toEqual({ left: 0, right: 352 }); // 228 left over
    expect(freeArea(992, true, true)).toEqual({ left: 320, right: 352 }); // exactly 320
  });

  it("re-fits only when bounds grow more than 15%", () => {
    expect(grewBeyond({ w: 100, h: 100 }, { w: 115, h: 100 })).toBe(false);
    expect(grewBeyond({ w: 100, h: 100 }, { w: 116, h: 90 })).toBe(true);
    expect(grewBeyond({ w: 100, h: 100 }, { w: 80, h: 120 })).toBe(true);
  });
});

describe("placeLabel (6.2)", () => {
  const base = {
    x: 0,
    y: 0,
    top: 4,
    bottom: 4,
    side: 4,
    width: 40,
    size: 12,
    k: 1,
    sunBoxes: [] as { x0: number; y0: number; x1: number; y1: number }[],
    sunDiscs: [] as { x: number; y: number; r: number }[],
  };

  it("stays below when nothing is in the way", () => {
    const s = placeLabel(base);
    expect(s.spot).toBe("below");
    expect(s.y).toBe(7);
    expect(s.baseline).toBe("top");
  });

  it("moves above when the default spot hits a sun disc below", () => {
    const s = placeLabel({ ...base, sunDiscs: [{ x: 0, y: 30, r: 20 }] });
    expect(s.spot).toBe("above");
    expect(s.y).toBe(-7);
    expect(s.baseline).toBe("bottom");
  });

  it("goes to the side away from the sun when above is blocked too", () => {
    const sunBoxes = [{ x0: -30, y0: -40, x1: 30, y1: -12 }];
    const left = placeLabel({ ...base, x: 0, sunBoxes, sunDiscs: [{ x: -5, y: 30, r: 20 }] });
    expect(left.spot).toBe("side");
    expect(left.align).toBe("left");
    expect(left.x).toBe(10);
    const right = placeLabel({ ...base, x: 0, sunBoxes, sunDiscs: [{ x: 5, y: 30, r: 20 }] });
    expect(right.align).toBe("right");
    expect(right.x).toBe(-10);
  });

  it("falls back to above when every spot is blocked", () => {
    const wall = [{ x0: -500, y0: -500, x1: 500, y1: 500 }];
    expect(placeLabel({ ...base, sunBoxes: wall }).spot).toBe("above");
  });

  it("also avoids extra boxes (the selected label for path labels)", () => {
    const avoid = [{ x0: -50, y0: 5, x1: 50, y1: 30 }];
    expect(placeLabel({ ...base, avoid }).spot).toBe("above");
  });

  it("scales gaps with the zoom", () => {
    expect(placeLabel({ ...base, k: 2 }).y).toBe(5.5);
  });
});

describe("box helpers", () => {
  it("detect box/box and box/circle overlap", () => {
    const b = { x0: 0, y0: 0, x1: 10, y1: 10 };
    expect(boxesOverlap(b, { x0: 5, y0: 5, x1: 20, y1: 20 })).toBe(true);
    expect(boxesOverlap(b, { x0: 10, y0: 0, x1: 20, y1: 10 })).toBe(false);
    expect(boxHitsCircle(b, 15, 5, 6)).toBe(true);
    expect(boxHitsCircle(b, 20, 20, 5)).toBe(false);
  });
});
