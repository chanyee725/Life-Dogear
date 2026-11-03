/**
 * Pure helpers for the cosmos view (docs/design/cosmos.md): sizes, brightness, glow,
 * galaxy anchors and colors, sun placement, nebulae, label thresholds and the seeded
 * background star field. No React, no DOM.
 */
import type { CosmosNodeInfo } from "@/lib/cosmos/types";
import type { GraphNode } from "@/lib/graph/types";
import { COSMOS_THEME, GALAXY } from "./graph-theme";
import { baseRadius, DENSE_GRAPH, LARGE_GRAPH, labelZoom } from "./model";

// ---------- Nodes (3절) ----------

/** 3.2: `r = min(base·(0.85 + 0.9·s), 18)`; reviews/topics 3.5; base −1 (≥ 3) when large. */
export function cosmosRadius(
  node: Pick<GraphNode, "type" | "horizon">,
  s: number,
  nodeCount: number,
): number {
  if (node.type === "review" || node.type === "tag") return 3.5;
  const base0 = baseRadius(node);
  const base = nodeCount > LARGE_GRAPH ? Math.max(base0 - 1, 3) : base0;
  return Math.min(base * (0.85 + 0.9 * s), 18);
}

/** 3.2: `alpha = 0.75 + 0.25·s`; reviews/topics fixed 0.75. */
export function cosmosAlpha(node: Pick<GraphNode, "type">, s: number): number {
  if (node.type === "review" || node.type === "tag") return 0.75;
  return 0.75 + 0.25 * s;
}

/** 3.3 glow: null when skipped (s < 0.15, or s < 0.5 on large graphs). */
export function glowFor(
  r: number,
  s: number,
  nodeCount: number,
): { radius: number; alpha: number } | null {
  if (s < 0.15 || (nodeCount > LARGE_GRAPH && s < 0.5)) return null;
  return { radius: r * (1.8 + 1.7 * s), alpha: 0.1 + 0.3 * s };
}

/** 3.4: active life goals are suns (achieved/dropped ones are drawn as year goals). */
export const isSun = (node: Pick<GraphNode, "type" | "horizon">, status?: string) =>
  node.type === "goal" && node.horizon === "life" && status !== "achieved" && status !== "dropped";

export const sunRadius = (sunCount: number) => (sunCount >= 4 ? 12 : 14);

/** 3.4: suns pinned at the centre — 1: origin; 2–3: on a 50g circle; 4+: on an 80g circle. */
export function sunPositions(count: number): { x: number; y: number }[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y: 0 }];
  const radius = count >= 4 ? 80 : 50;
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / count;
    return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
  });
}

// ---------- Galaxies (1.1, 4절) ----------

/** Color for a galaxy (area id) given the area order; neutral when none. */
export function galaxyColor(galaxy: string | null, order: ReadonlyMap<string, number>): string {
  if (galaxy === null) return COSMOS_THEME.neutral;
  const i = order.get(galaxy);
  return i === undefined ? COSMOS_THEME.neutral : GALAXY[i % GALAXY.length]!;
}

/** 4절: anchor of the i-th visible galaxy on a circle of radius 220 + 30·N, from the top, clockwise. */
export function galaxyAnchors(count: number): { x: number; y: number }[] {
  if (count <= 0) return [];
  const R = 220 + 30 * count;
  if (count === 1) return [{ x: R, y: 0 }];
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / count;
    return { x: R * Math.cos(a), y: R * Math.sin(a) };
  });
}

export const galaxyRingRadius = (count: number) => 220 + 30 * count;

// ---------- Labels (9절) ----------

/** Zoom from which a label shows: nodes with s ≥ 0.6 show as early as goals/areas. */
export function cosmosLabelZoom(
  node: Pick<GraphNode, "type" | "horizon">,
  s: number,
  nodeCount: number,
): number {
  if (s >= 0.6) return nodeCount > DENSE_GRAPH ? 1.3 : 0.8;
  return labelZoom(node, nodeCount);
}

// ---------- Nebulae (2.1) ----------

export type Nebula = { galaxy: string; x: number; y: number; radius: number };

/**
 * One nebula per galaxy with 3+ positioned nodes: centred on their centroid, radius =
 * farthest member + 40g (min 80g). None when the graph is large.
 */
export function nebulae(
  nodes: readonly { x?: number; y?: number; galaxy: string | null }[],
  nodeCount: number,
): Nebula[] {
  if (nodeCount > LARGE_GRAPH) return [];
  const groups = new Map<string, { x: number; y: number }[]>();
  for (const n of nodes) {
    if (n.galaxy === null || n.x == null || n.y == null) continue;
    const g = groups.get(n.galaxy);
    if (g) g.push({ x: n.x, y: n.y });
    else groups.set(n.galaxy, [{ x: n.x, y: n.y }]);
  }
  const out: Nebula[] = [];
  for (const [galaxy, pts] of groups) {
    if (pts.length < 3) continue;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const far = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy)));
    out.push({ galaxy, x: cx, y: cy, radius: Math.max(far + 40, 80) });
  }
  return out;
}

// ---------- Background stars (2.2) ----------

export type BackgroundStar = {
  x: number;
  y: number;
  r: number;
  alpha: number;
  color: string;
  /** Twinkle period in seconds; null for steady stars. */
  twinkle: number | null;
  phase: number;
};

/** mulberry32: seeded PRNG so the sky is the same on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0.12 stars per 1,000 px², clamped to 60..400. */
export function starCount(width: number, height: number): number {
  return Math.round(Math.min(400, Math.max(60, ((width * height) / 1000) * 0.12)));
}

export function makeStars(width: number, height: number, seed = 42): BackgroundStar[] {
  const rand = mulberry32(seed);
  const between = (a: number, b: number) => a + (b - a) * rand();
  return Array.from({ length: starCount(width, height) }, () => {
    const sizeRoll = rand();
    const r =
      sizeRoll < 0.7 ? between(0.5, 0.9) : sizeRoll < 0.95 ? between(0.9, 1.3) : between(1.3, 1.7);
    const colorRoll = rand();
    const color =
      colorRoll < 0.75
        ? COSMOS_THEME.starWhite
        : colorRoll < 0.9
          ? COSMOS_THEME.starBlue
          : COSMOS_THEME.starWarm;
    const twinkles = rand() < 0.08;
    return {
      x: rand() * width,
      y: rand() * height,
      r,
      alpha: r >= 1.3 ? between(0.55, 0.85) : between(0.2, 0.7),
      color,
      twinkle: twinkles ? between(4, 7) : null,
      phase: rand() * Math.PI * 2,
    };
  });
}

/** Drift direction (−0.96, 0.28) at 4 px/s; parallax 0.08 of the pan. */
export const STAR_DRIFT = { x: -0.96 * 4, y: 0.28 * 4 } as const;
export const STAR_PARALLAX = 0.08;

/** Wraps a coordinate into [0, size). */
export const wrap = (v: number, size: number) => ((v % size) + size) % size;

/** Score lookup with a neutral default. */
export const scoreOf = (info: CosmosNodeInfo | undefined) => info?.score ?? 0;

// ---------- Free area (4.1) ----------

export const PANEL_INSET = 320; // 16 + 288 + 16
export const PREVIEW_INSET = 352; // 16 + 320 + 16
export const MIN_FREE_WIDTH = 320;

/**
 * Horizontal insets of the area not covered by overlays: the side panel (when expanded)
 * on the left, the preview (when open) on the right. If the free width would drop below
 * 320px, the left panel is not subtracted, so the graph never disappears.
 */
export function freeArea(
  width: number,
  panelExpanded: boolean,
  previewOpen: boolean,
): { left: number; right: number } {
  const right = previewOpen ? PREVIEW_INSET : 0;
  const left = panelExpanded ? PANEL_INSET : 0;
  return width - left - right < MIN_FREE_WIDTH ? { left: 0, right } : { left, right };
}

/** True when the bounds grew by more than 15% in width or height (re-fit on settle). */
export function grewBeyond(
  prev: { w: number; h: number },
  next: { w: number; h: number },
  ratio = 1.15,
): boolean {
  const eps = 1e-9; // 100 × 1.15 is 114.999… in floating point
  return next.w > prev.w * ratio + eps || next.h > prev.h * ratio + eps;
}
