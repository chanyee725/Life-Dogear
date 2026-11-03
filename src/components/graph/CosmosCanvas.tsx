"use client";

/**
 * Cosmos view canvas (docs/design/cosmos.md) on react-force-graph-2d. Same shapes,
 * keyboard API (`GraphCanvasApi`) and data as the base canvas; different colors, sizes,
 * glow, forces and the "왜 중요한가" constellation. Client only — load it lazily.
 *
 * Draw order (3.3): nebulae → edges → glow (all in onRenderFramePre; the library's own
 * link drawing is off) → nodes (nodeCanvasObject) → labels (onRenderFramePost).
 * The canvas is transparent; the wrapper paints `space` and the StarField behind it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject,
} from "react-force-graph-2d";
import type { Constellation } from "@/lib/cosmos/path";
import type { CosmosNodeInfo, CosmosResponse } from "@/lib/cosmos/types";
import type { GraphEdgeKind, GraphNode, GraphNodeId } from "@/lib/graph/types";
import {
  cosmosAlpha,
  cosmosLabelZoom,
  cosmosRadius,
  galaxyAnchors,
  galaxyColor,
  galaxyRingRadius,
  glowFor,
  grewBeyond,
  type Box,
  boxesOverlap,
  placeLabel,
  type Nebula,
  nebulae as computeNebulae,
  sunPositions,
  sunRadius,
} from "./cosmos-model";
import { shapeBottom, traceShape, withAlpha } from "./draw";
import { forceAxis, forceCollideGrid, forceRadial } from "./forces";
import type { GraphCanvasApi } from "./GraphCanvas";
import { COSMOS_THEME as C } from "./graph-theme";
import { buildNeighbors, DENSE_GRAPH, LARGE_GRAPH, labelText } from "./model";

type CosmosSim = GraphNode & {
  r: number;
  s: number;
  baseAlpha: number;
  galaxy: string | null;
  color: string;
  sun: boolean;
  starred: boolean;
};
type SimNode = NodeObject<CosmosSim>;
type SimLink = LinkObject<SimNode, { kind: GraphEdgeKind }>;

export type CosmosCanvasProps = {
  data: CosmosResponse;
  reducedMotion: boolean;
  width: number;
  height: number;
  selectedId?: GraphNodeId | null;
  focusId?: GraphNodeId | null;
  /** Hover coming from outside the canvas (side panel rows). */
  externalHoverId?: GraphNodeId | null;
  /** "왜 중요한가" path of the selected node. */
  constellation?: Constellation | null;
  fitKey?: string;
  /** Overlay insets (4.1): fits and moves use the free area between them. */
  insets?: { left: number; right: number };
  onNodeClick?: (node: GraphNode, event: MouseEvent) => void;
  onBackgroundClick?: () => void;
  onHover?: (id: GraphNodeId | null) => void;
  onReady?: (api: GraphCanvasApi) => void;
  /** Pan/zoom changed; `x`, `y` are the screen translation (for star parallax). */
  onTransform?: (t?: { k: number; x: number; y: number }) => void;
};

const FADE_MS = 120;
const NO_INSETS = { left: 0, right: 0 };
const FIT_PAD = 64;
const PATH_MS = 450;

type Emph =
  | { kind: "none" }
  | { kind: "hover"; h: GraphNodeId; n: Set<GraphNodeId> }
  | {
      kind: "select";
      s: GraphNodeId;
      p: Set<GraphNodeId>;
      /** P by distance from S (label priority). */
      order: GraphNodeId[];
      n: Set<GraphNodeId>;
      edges: Set<string>;
    };

const NONE: Emph = { kind: "none" };

let measureCanvas: CanvasRenderingContext2D | null = null;
/** Shared 2D context for measuring label text outside a frame. */
function measureCtx(): CanvasRenderingContext2D {
  measureCanvas ??= document.createElement("canvas").getContext("2d")!;
  return measureCanvas;
}

// ---------- Glow sprites (3.3): one 64×64 radial sprite per color, (1 − t)² falloff ----------
const spriteCache = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string): HTMLCanvasElement {
  let sprite = spriteCache.get(color);
  if (sprite) return sprite;
  sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const g = sprite.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    grad.addColorStop(t, withAlpha(color, (1 - t) ** 2));
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  spriteCache.set(color, sprite);
  return sprite;
}

const colorCache = new Map<string, string>();
function rgba(base: string, alpha: number): string {
  const key = `${base}|${Math.round(alpha * 100)}`;
  let c = colorCache.get(key);
  if (!c) colorCache.set(key, (c = withAlpha(base, Math.round(alpha * 100) / 100)));
  return c;
}

const endId = (end: SimLink["source"]): GraphNodeId =>
  (typeof end === "object" && end !== null ? String(end.id) : String(end)) as GraphNodeId;
const endNode = (end: SimLink["source"]): SimNode | null =>
  typeof end === "object" && end !== null ? (end as SimNode) : null;

/** Four-pointed star ✦ centred at (x, y), `size` across. */
function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const a = size / 2;
  const b = size / 7;
  ctx.beginPath();
  ctx.moveTo(x, y - a);
  ctx.lineTo(x + b, y - b);
  ctx.lineTo(x + a, y);
  ctx.lineTo(x + b, y + b);
  ctx.lineTo(x, y + a);
  ctx.lineTo(x - b, y + b);
  ctx.lineTo(x - a, y);
  ctx.lineTo(x - b, y - b);
  ctx.closePath();
  ctx.fill();
}

export default function CosmosCanvas({
  data,
  reducedMotion,
  width,
  height,
  selectedId = null,
  focusId = null,
  externalHoverId = null,
  constellation = null,
  fitKey = "",
  insets = NO_INSETS,
  onNodeClick,
  onBackgroundClick,
  onHover,
  onReady,
  onTransform,
}: CosmosCanvasProps) {
  const fgRef = useRef<ForceGraphMethods<SimNode, SimLink> | undefined>(undefined);
  const simCache = useRef(new Map<string, SimNode>());
  const [hoverId, setHoverId] = useState<GraphNodeId | null>(null);
  const [animating, setAnimating] = useState(false);
  const kTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kRef = useRef(1);
  const nebulaRef = useRef<Nebula[]>([]);

  const count = data.nodes.length;
  const large = count > LARGE_GRAPH;
  const neighbors = useMemo(() => buildNeighbors(data.edges), [data.edges]);
  const order = useMemo(
    () => new Map(data.galaxies.map((g, i) => [g.id, i] as const)),
    [data.galaxies],
  );

  // ----- Simulation nodes -----
  // The simulation is rebuilt only when nodes/edges change; score-only updates (a star
  // toggled on the client) are applied in place below so the layout does not restart.
  const cosmosRef = useRef(data.cosmos);
  cosmosRef.current = data.cosmos;
  const applyInfo = useCallback(
    (nodes: SimNode[]) => {
      const info = (id: GraphNodeId): CosmosNodeInfo | undefined => cosmosRef.current[id];
      const sunCount = nodes.filter((n) => info(n.id as GraphNodeId)?.sun).length;
      for (const node of nodes) {
        const ci = info(node.id as GraphNodeId);
        const s = ci?.score ?? 0;
        node.s = s;
        node.sun = !!ci?.sun;
        node.starred = !!ci?.starred;
        node.galaxy = ci?.galaxy ?? null;
        node.color = galaxyColor(node.galaxy, order);
        node.baseAlpha = cosmosAlpha(node, s);
        const lifeNotSun = node.type === "goal" && node.horizon === "life" && !node.sun;
        node.r = node.sun ? sunRadius(sunCount) : lifeNotSun ? 9 : cosmosRadius(node, s, count);
      }
    },
    [order, count],
  );

  const graphData = useMemo(() => {
    const prev = simCache.current;
    const next = new Map<string, SimNode>();
    const nodes = data.nodes.map((n) => {
      const old = prev.get(n.id);
      const node: SimNode = old ? Object.assign(old, n) : ({ ...n } as SimNode);
      next.set(n.id, node);
      return node;
    });
    applyInfo(nodes);
    // Suns are pinned (by score, then id); saved free-layout pins never apply here.
    const suns = nodes.filter((n) => n.sun).sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : 1));
    const spots = sunPositions(suns.length);
    for (const node of nodes) {
      node.fx = undefined;
      node.fy = undefined;
    }
    suns.forEach((node, i) => {
      node.fx = node.x = spots[i]!.x;
      node.fy = node.y = spots[i]!.y;
    });
    simCache.current = next;
    const links: SimLink[] = data.edges.map((e) => ({
      source: e.source,
      target: e.target,
      kind: e.kind,
    }));
    // `data.cosmos` changes are applied in place (effect below).
    return { nodes, links };
  }, [data.nodes, data.edges, applyInfo]);

  useEffect(() => {
    applyInfo(graphData.nodes);
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), 100);
    return () => clearTimeout(t);
  }, [data.cosmos, graphData, applyInfo]);

  // ----- Forces (4절) -----
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const anchors = galaxyAnchors(data.galaxies.length);
    const anchorOf = (g: string | null) => {
      const i = g === null ? undefined : order.get(g);
      return i === undefined ? null : anchors[i]!;
    };
    const R = galaxyRingRadius(data.galaxies.length);
    const isGoalChild = (n: SimNode) =>
      n.type === "goal" && (n.horizon === "year" || n.horizon === "quarter");

    const charge = fg.d3Force("charge");
    charge?.strength?.(-80);
    charge?.distanceMax?.(400);
    const link = fg.d3Force("link");
    link?.distance?.((l: SimLink) => (l.kind === "belongs" ? 40 : 70));
    link?.strength?.((l: SimLink) => {
      const a = endNode(l.source);
      const b = endNode(l.target);
      if (a?.galaxy && b?.galaxy && a.galaxy !== b.galaxy) return 0.02;
      return (
        1 /
        Math.max(
          1,
          Math.min(
            neighbors.get(endId(l.source))?.size ?? 1,
            neighbors.get(endId(l.target))?.size ?? 1,
          ),
        )
      );
    });
    fg.d3Force("center", null);
    for (const axis of ["x", "y"] as const) {
      fg.d3Force(
        `galaxy-${axis}`,
        forceAxis<SimNode>(
          axis,
          (n) => {
            const a = anchorOf(n.galaxy);
            if (!a || n.sun) return null;
            const v = axis === "x" ? a.x : a.y;
            return isGoalChild(n) ? v * 0.45 : v;
          },
          (n) => (n.type === "area" ? 0.5 : isGoalChild(n) ? 0.15 : 0.12),
        ),
      );
    }
    fg.d3Force(
      "radial",
      forceRadial<SimNode>(
        (n) => {
          if (n.sun || anchorOf(n.galaxy)) return null;
          return isGoalChild(n) ? 120 : R * 0.55;
        },
        (n) => (isGoalChild(n) ? 0.1 : 0.03),
      ),
    );
    fg.d3Force(
      "collide",
      forceCollideGrid<SimNode>((n) => n.r + 6),
    );
    fg.d3ReheatSimulation();
  }, [graphData, data.galaxies, order, neighbors]);

  // ----- Emphasis: hover (incl. from the panel) beats the selected constellation -----
  const activeHover = hoverId ?? externalHoverId;
  const target = useMemo<Emph>(() => {
    if (activeHover) {
      return { kind: "hover", h: activeHover, n: new Set(neighbors.get(activeHover) ?? []) };
    }
    if (selectedId && constellation) {
      const n = new Set<GraphNodeId>();
      for (const id of neighbors.get(selectedId) ?? []) if (!constellation.nodes.has(id)) n.add(id);
      return {
        kind: "select",
        s: selectedId,
        p: constellation.nodes,
        order: constellation.order,
        n,
        edges: constellation.edges,
      };
    }
    return NONE;
  }, [activeHover, selectedId, constellation, neighbors]);

  const fade = useRef<{ from: Emph; to: Emph; start: number; pathStart: number }>({
    from: NONE,
    to: NONE,
    start: 0,
    pathStart: 0,
  });
  const instant = reducedMotion || large;

  const kick = useCallback((ms = FADE_MS + 60) => {
    setAnimating(true);
    if (kTimer.current) clearTimeout(kTimer.current);
    kTimer.current = setTimeout(() => setAnimating(false), ms);
  }, []);
  useEffect(
    () => () => {
      if (kTimer.current) clearTimeout(kTimer.current);
    },
    [],
  );

  const lastSelected = useRef<GraphNodeId | null>(null);
  useEffect(() => {
    const f = fade.current;
    const now = performance.now();
    f.from = f.to;
    f.to = target;
    f.start = instant ? now - FADE_MS : now;
    if (target.kind === "select" && target.s !== lastSelected.current) {
      f.pathStart = reducedMotion ? now - PATH_MS : now;
      kick(PATH_MS + 80);
    } else {
      kick();
    }
    lastSelected.current = target.kind === "select" ? target.s : selectedId;
  }, [target, instant, reducedMotion, kick, selectedId]);
  useEffect(() => kick(), [focusId, kick]);

  const progress = () => {
    const t = (performance.now() - fade.current.start) / FADE_MS;
    return t >= 1 ? 1 : t <= 0 ? 0 : t;
  };
  const pathProgress = () => {
    const t = Math.min(1, Math.max(0, (performance.now() - fade.current.pathStart) / PATH_MS));
    return 1 - (1 - t) ** 3; // ease-out
  };

  /** Node visibility factor under an emphasis. */
  const factorIn = (id: GraphNodeId, e: Emph) => {
    if (e.kind === "hover") return id === e.h || e.n.has(id) ? 1 : 0.15;
    if (e.kind === "select") return id === e.s || e.p.has(id) ? 1 : e.n.has(id) ? 0.55 : 0.12;
    return 1;
  };
  const glowOn = (id: GraphNodeId, e: Emph) => {
    if (e.kind === "hover") return id === e.h || e.n.has(id);
    if (e.kind === "select") return id === e.s || e.p.has(id);
    return true;
  };
  const nodeFactor = (id: GraphNodeId) => {
    const t = progress();
    const { from, to } = fade.current;
    return t >= 1 ? factorIn(id, to) : factorIn(id, from) * (1 - t) + factorIn(id, to) * t;
  };

  const live = useRef({
    selectedId,
    focusId,
    count,
    large,
    width,
    height,
    nodeFactor,
    glowOn,
    order,
  });
  live.current = { selectedId, focusId, count, large, width, height, nodeFactor, glowOn, order };

  // ----- Nodes -----
  const nodeCanvasObject = useCallback(
    (node: SimNode, ctx: CanvasRenderingContext2D, k: number) => {
      const L = live.current;
      const id = node.id as GraphNodeId;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const r = node.r;
      const factor = L.nodeFactor(id);
      ctx.globalAlpha = (node.archived ? 0.45 : node.sun ? 1 : node.baseAlpha) * factor;

      if (node.sun) {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, C.goldCore);
        grad.addColorStop(1, C.gold);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
        ctx.lineWidth = 1.5 / k;
        ctx.strokeStyle = C.gold;
        ctx.stroke();
      } else {
        traceShape(ctx, node.type, x, y, r);
        switch (node.type) {
          case "goal":
            if (node.horizon === "quarter") {
              ctx.fillStyle = C.space;
              ctx.fill();
              ctx.lineWidth = 1.5 / k;
              ctx.strokeStyle = C.gold;
              ctx.stroke();
            } else {
              ctx.fillStyle = C.gold;
              ctx.fill();
            }
            break;
          case "thought":
            ctx.fillStyle = C.space;
            ctx.fill();
            ctx.lineWidth = 2 / k;
            ctx.strokeStyle = node.color;
            ctx.stroke();
            break;
          case "tag":
            ctx.fillStyle = C.space;
            ctx.fill();
            ctx.lineWidth = 1.25 / k;
            ctx.strokeStyle = C.neutral;
            ctx.stroke();
            break;
          case "review":
            ctx.fillStyle = C.neutral;
            ctx.fill();
            break;
          default:
            ctx.fillStyle = node.color;
            ctx.fill();
        }
      }

      if (node.starred && k >= 0.8) {
        const d = (r + 2) * Math.SQRT1_2;
        ctx.fillStyle = C.goldCore;
        drawSparkle(ctx, x + d, y - d, 7 / k);
      }
      if (id === L.selectedId || id === L.focusId) {
        ctx.globalAlpha = 1;
        traceShape(ctx, node.type === "goal" ? "paper" : node.type, x, y, r + 3 / k);
        ctx.lineWidth = 2 / k;
        ctx.strokeStyle = C.focus;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    [],
  );

  const nodePointerAreaPaint = useCallback(
    (node: SimNode, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, Math.max(node.r + 2, 10 / kRef.current), 0, 2 * Math.PI);
      ctx.fill();
    },
    [],
  );

  // ----- Pre-frame: nebulae → edges → glow -----
  const graphRef = useRef(graphData);
  graphRef.current = graphData;

  const restEdge = (l: SimLink, isLarge: boolean) => {
    if (l.kind === "belongs") {
      const child = endNode(l.source);
      const neutral = !child?.galaxy;
      return {
        color: neutral ? C.edge : child!.color,
        alpha: isLarge ? 0.28 : neutral ? 0.3 : 0.35,
        width: isLarge ? 1 : 1.25,
      };
    }
    return {
      color: C.edge,
      alpha: isLarge ? 0.08 : l.kind === "topic" ? 0.12 : 0.14,
      width: isLarge ? 0.5 : 0.75,
    };
  };
  const edgeAlphaIn = (l: SimLink, e: Emph, rest: number): number => {
    const s = endId(l.source);
    const t = endId(l.target);
    if (e.kind === "hover") return s === e.h || t === e.h ? 0.7 : 0.03;
    if (e.kind === "select") {
      if (e.edges.has(`${s}|${t}`)) return 0; // drawn in the path pass
      if (s === e.s || t === e.s) return 0.35;
      return 0.03;
    }
    return rest;
  };
  const fns = useRef({ restEdge, edgeAlphaIn, progress, pathProgress });
  fns.current = { restEdge, edgeAlphaIn, progress, pathProgress };

  const onRenderFramePre = useCallback((ctx: CanvasRenderingContext2D, k: number) => {
    kRef.current = k;
    const fg = fgRef.current;
    if (!fg) return;
    const L = live.current;
    const F = fns.current;
    const { nodes, links } = graphRef.current;
    const tl = fg.screen2GraphCoords(0, 0);
    const br = fg.screen2GraphCoords(L.width, L.height);
    const inView = (x: number, y: number, pad: number) =>
      x > tl.x - pad && x < br.x + pad && y > tl.y - pad && y < br.y + pad;

    // 1. Nebulae.
    for (const n of nebulaRef.current) {
      if (!inView(n.x, n.y, n.radius)) continue;
      const color = galaxyColor(n.galaxy, L.order);
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
      grad.addColorStop(0, rgba(color, 0.07));
      grad.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
      ctx.fill();
    }

    // 2. Edges (path edges last).
    const t = F.progress();
    const { from, to } = fade.current;
    const pathLinks: SimLink[] = [];
    for (const l of links) {
      const a = endNode(l.source);
      const b = endNode(l.target);
      if (!a || !b || a.x == null || b.x == null) continue;
      if (to.kind === "select" && to.edges.has(`${a.id}|${b.id}`)) {
        pathLinks.push(l);
        continue;
      }
      const rest = F.restEdge(l, L.large);
      const alpha =
        t >= 1
          ? F.edgeAlphaIn(l, to, rest.alpha)
          : F.edgeAlphaIn(l, from, rest.alpha) * (1 - t) + F.edgeAlphaIn(l, to, rest.alpha) * t;
      if (alpha <= 0.005) continue;
      const touchesHover = to.kind === "hover" && (a.id === to.h || b.id === to.h);
      const touchesSel = to.kind === "select" && (a.id === to.s || b.id === to.s);
      ctx.strokeStyle = rgba(touchesSel ? C.edge : rest.color, alpha);
      ctx.lineWidth = (touchesSel ? 1 : rest.width + (touchesHover ? 0.5 : 0)) / k;
      ctx.setLineDash(l.kind === "topic" ? [2 / k, 3 / k] : []);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y!);
      ctx.lineTo(b.x, b.y!);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Constellation: glow underlay + line, drawn from S's side toward the sun.
    if (to.kind === "select" && pathLinks.length) {
      const p = F.pathProgress();
      for (const pass of [
        { width: 7, alpha: 0.22 },
        { width: 2.5, alpha: 0.95 },
      ]) {
        ctx.strokeStyle = rgba(C.path, pass.alpha);
        ctx.lineWidth = pass.width / k;
        ctx.lineCap = "round";
        for (const l of pathLinks) {
          let a = endNode(l.source)!;
          let b = endNode(l.target)!;
          // Belongs edges already run child → parent; the first hop runs from S.
          if (l.kind !== "belongs" && b.id === to.s) [a, b] = [b, a];
          const ax = a.x!;
          const ay = a.y!;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax + (b.x! - ax) * p, ay + (b.y! - ay) * p);
          ctx.stroke();
        }
      }
      ctx.lineCap = "butt";
    }

    // 3. Glow.
    for (const n of nodes) {
      if (n.x == null || n.y == null || n.archived) continue;
      const id = n.id as GraphNodeId;
      if (!L.glowOn(id, to)) continue;
      let glow = n.sun ? { radius: n.r * 4.5, alpha: 0.45 } : glowFor(n.r, n.s, L.count);
      if (!glow) continue;
      if (to.kind === "select" && id === to.s) glow = { ...glow, alpha: glow.alpha + 0.15 };
      if (!inView(n.x, n.y, glow.radius)) continue;
      const color =
        n.type === "goal" ? C.gold : n.type === "review" || n.type === "tag" ? C.neutral : n.color;
      ctx.globalAlpha = Math.min(1, glow.alpha) * L.nodeFactor(id);
      ctx.drawImage(
        glowSprite(color),
        n.x - glow.radius,
        n.y - glow.radius,
        glow.radius * 2,
        glow.radius * 2,
      );
    }
    ctx.globalAlpha = 1;
  }, []);

  // ----- Labels (9절) -----
  const labelOrder = useMemo(
    () => [...graphData.nodes].sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : 1)),
    // Re-sort when scores change in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphData, data.cosmos],
  );
  const labelRef = useRef(labelOrder);
  labelRef.current = labelOrder;

  /**
   * 9절: labels in priority order, skipping any whose box (text + 2s each side) overlaps
   * one already drawn — always while something is emphasised, otherwise above 300 nodes.
   * Emphasised: S > P (nearest S first) > H > N; sun labels are never skipped.
   */
  const onRenderFramePost = useCallback((ctx: CanvasRenderingContext2D, k: number) => {
    const fg = fgRef.current;
    if (!fg) return;
    const L = live.current;
    const to = fade.current.to;
    const tl = fg.screen2GraphCoords(0, 0);
    const br = fg.screen2GraphCoords(L.width, L.height);
    const emphasised = to.kind !== "none";
    const cull = emphasised || L.count > DENSE_GRAPH;
    const boxes: Box[] = [];
    const drawn = new Set<string>();
    const byId = simCache.current;
    const lit = (id: GraphNodeId) =>
      to.kind === "none" ||
      (to.kind === "hover"
        ? id === to.h || to.n.has(id)
        : id === to.s || to.p.has(id) || to.n.has(id));

    const sunBoxes: Box[] = [];
    const sunDiscs: { x: number; y: number; r: number }[] = [];
    /** Shape extents from the centre (top, bottom, side) in graph units. */
    const extents = (n: SimNode) => {
      if (n.sun) return { top: n.r + 3, bottom: n.r + 3, side: n.r + 3 };
      const bottom = shapeBottom(n.type, n.r);
      const top = n.type === "seminar" ? 1.3 * n.r : bottom;
      const side =
        n.type === "project" || n.type === "tag"
          ? 1.3 * n.r
          : n.type === "seminar"
            ? 1.3 * n.r * Math.cos(Math.PI / 6)
            : n.type === "area" || n.type === "review"
              ? 0.875 * n.r
              : n.r;
      return { top, bottom, side };
    };

    const draw = (
      n: SimNode | undefined,
      opts: {
        strong: boolean;
        weight: number;
        size?: number;
        always?: boolean;
        keep?: boolean;
        /** Step aside from sun labels/discs (6.2), also avoiding these boxes. */
        avoidSuns?: boolean;
        avoid?: Box[];
        sun?: boolean;
      },
    ): Box | null => {
      if (!n || drawn.has(n.id as string)) return null;
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      if (x < tl.x - 200 || x > br.x + 200 || y < tl.y - 50 || y > br.y + 50) return null;
      const id = n.id as GraphNodeId;
      if (!lit(id) && !opts.always) return null;
      const text = labelText(n, opts.strong);
      const size = (opts.size ?? 12) / k;
      ctx.font = `${opts.weight} ${size}px ui-sans-serif, system-ui, sans-serif`;
      const ext = extents(n);
      const spot = placeLabel({
        x,
        y,
        ...ext,
        width: ctx.measureText(text).width,
        size,
        k,
        sunBoxes: opts.avoidSuns ? sunBoxes : [],
        sunDiscs: opts.avoidSuns ? sunDiscs : [],
        avoid: opts.avoidSuns ? opts.avoid : undefined,
      });
      if (cull && !opts.keep && boxes.some((b) => boxesOverlap(b, spot.box))) return null;
      boxes.push(spot.box);
      if (opts.sun) {
        sunBoxes.push(spot.box);
        sunDiscs.push({ x, y, r: n.r + 3 + 1.5 / k });
      }
      ctx.globalAlpha = lit(id) ? 1 : 0.5;
      ctx.textAlign = spot.align;
      ctx.textBaseline = spot.baseline;
      ctx.lineJoin = "round";
      ctx.lineWidth = 3.5 / k;
      ctx.strokeStyle = C.space;
      ctx.strokeText(text, spot.x, spot.y);
      ctx.fillStyle = opts.strong ? C.labelStrong : C.label;
      ctx.fillText(text, spot.x, spot.y);
      drawn.add(n.id as string);
      return spot.box;
    };

    const get = (id: GraphNodeId | null | undefined) => (id ? byId.get(id) : undefined);
    // Suns first: their labels never move or drop, and S/P step aside from them.
    for (const n of labelRef.current) {
      if (n.sun)
        draw(n, { strong: true, weight: 600, size: 13, always: true, keep: true, sun: true });
    }
    let sBox: Box | null = null;
    if (to.kind === "select") {
      sBox = draw(get(to.s), { strong: true, weight: 600, keep: true, avoidSuns: true });
    }
    if (to.kind === "hover") draw(get(to.h), { strong: true, weight: 500, keep: true });
    if (to.kind === "select") {
      for (const id of to.order) {
        draw(get(id), {
          strong: true,
          weight: 500,
          always: true,
          avoidSuns: true,
          avoid: sBox ? [sBox] : [],
        });
      }
    }
    if (to.kind !== "none") {
      for (const id of to.n) draw(get(id), { strong: false, weight: 400, always: true });
    }
    draw(get(L.focusId), { strong: true, weight: 500, always: !emphasised });
    if (!emphasised) {
      let budget = 400;
      for (const n of labelRef.current) {
        if (budget <= 0) break;
        if (k < cosmosLabelZoom(n, n.s, L.count)) continue;
        const weight = n.type === "goal" || n.type === "area" ? 500 : 400;
        draw(n, { strong: false, weight });
        budget--;
      }
    }
    ctx.globalAlpha = 1;
  }, []);

  // ----- Fit (4.1: into the free area between overlays) and nebulae -----
  const insetsRef = useRef(insets);
  insetsRef.current = insets;

  /** Bounds of the given nodes (all when omitted), padded by the largest radius. */
  const boundsOf = useCallback((ids?: ReadonlySet<GraphNodeId>) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    let maxR = 0;
    for (const n of graphRef.current.nodes) {
      if (n.x == null || n.y == null || (ids && !ids.has(n.id as GraphNodeId))) continue;
      x0 = Math.min(x0, n.x);
      y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x);
      y1 = Math.max(y1, n.y);
      maxR = Math.max(maxR, n.r);
    }
    if (x0 === Infinity) return null;
    const pad = maxR + 12;
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }, []);

  /**
   * Screen-px size of a node's selected label (600 12px) and its offset below the node
   * centre at zoom `k` — so a fit can keep the label inside the free area (6.2).
   */
  const labelExtent = useCallback((id: GraphNodeId, k: number) => {
    const n = simCache.current.get(id);
    if (!n) return null;
    const ctx = measureCtx();
    ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
    const w = ctx.measureText(labelText(n, true)).width + 4;
    const below = (n.sun ? n.r + 3 : shapeBottom(n.type, n.r)) * k + 3;
    return { w, top: below - 2, bottom: below + 15 + 2 };
  }, []);

  const fitView = useCallback(
    (
      duration: number,
      opts: { ids?: ReadonlySet<GraphNodeId>; noZoomIn?: boolean; labelFor?: GraphNodeId } = {},
    ) => {
      const fg = fgRef.current;
      const b0 = boundsOf(opts.ids);
      if (!fg || !b0) return null;
      const { left, right } = insetsRef.current;
      const freeW = Math.max(width - left - right, 1);
      const zoomFor = (b: Box) => {
        let k = Math.min(
          2.5,
          (freeW - FIT_PAD * 2) / Math.max(b.x1 - b.x0, 1),
          (height - FIT_PAD * 2) / Math.max(b.y1 - b.y0, 1),
        );
        if (opts.noZoomIn) k = Math.min(k, fg.zoom());
        return Math.max(0.2, k);
      };
      let b = b0;
      let k = zoomFor(b);
      // Include the selected label: its size is in screen px, so widen at this zoom and
      // re-fit once (the zoom only gets smaller, so the label still fits).
      const node = opts.labelFor ? simCache.current.get(opts.labelFor) : undefined;
      const ext = opts.labelFor ? labelExtent(opts.labelFor, k) : null;
      if (node && ext && node.x != null && node.y != null) {
        b = {
          x0: Math.min(b.x0, node.x - ext.w / 2 / k),
          x1: Math.max(b.x1, node.x + ext.w / 2 / k),
          y0: b.y0,
          y1: Math.max(b.y1, node.y + ext.bottom / k),
        };
        k = zoomFor(b);
      }
      const w = Math.max(b.x1 - b.x0, 1);
      const h = Math.max(b.y1 - b.y0, 1);
      // Put the bounds' centre at the free area's centre: shift by (left − right) / 2 px.
      const cx = (b.x0 + b.x1) / 2 - (left - right) / 2 / k;
      const cy = (b.y0 + b.y1) / 2;
      fg.zoom(k, duration);
      fg.centerAt(cx, cy, duration);
      return { w, h };
    },
    [boundsOf, labelExtent, width, height],
  );

  /** True when any of the nodes is outside the free area on screen. */
  const outsideFree = useCallback(
    (ids: Iterable<GraphNodeId>, labelFor?: GraphNodeId) => {
      const fg = fgRef.current;
      if (!fg) return false;
      const { left, right } = insetsRef.current;
      const out = (x: number, y: number) => x < left || x > width - right || y < 0 || y > height;
      for (const id of ids) {
        const n = simCache.current.get(id);
        if (!n || n.x == null || n.y == null) continue;
        const p = fg.graph2ScreenCoords(n.x, n.y);
        if (out(p.x, p.y)) return true;
      }
      const n = labelFor ? simCache.current.get(labelFor) : undefined;
      const ext = labelFor ? labelExtent(labelFor, fg.zoom()) : null;
      if (n && ext && n.x != null && n.y != null) {
        const p = fg.graph2ScreenCoords(n.x, n.y);
        if (out(p.x - ext.w / 2, p.y + ext.bottom) || out(p.x + ext.w / 2, p.y + ext.bottom)) {
          return true;
        }
      }
      return false;
    },
    [labelExtent, width, height],
  );

  const recomputeNebulae = useCallback(() => {
    nebulaRef.current = computeNebulae(
      graphRef.current.nodes.map((n) => ({ x: n.x, y: n.y, galaxy: n.galaxy })),
      graphRef.current.nodes.length,
    );
  }, []);

  const dur = useCallback((d: number) => (reducedMotion ? 0 : d), [reducedMotion]);
  // First entry / filter change: the library applies new data in a debounced update and
  // runs the 80 warm-up ticks there, so fit on its first engine tick — before that frame
  // is drawn — at 0ms (4절).
  const lastFit = useRef<{ w: number; h: number } | null>(null);
  const fittedKey = useRef<string | null>(null);
  const fitKeyRef = useRef(fitKey);
  fitKeyRef.current = fitKey;
  const fitIfNew = useCallback(() => {
    if (fittedKey.current === fitKeyRef.current) return;
    // Until the simulation has taken the new nodes, only the pinned suns have positions.
    if (graphRef.current.nodes.some((n) => n.x == null || n.y == null)) return;
    const size = fitView(0);
    if (!size) return;
    fittedKey.current = fitKeyRef.current;
    lastFit.current = size;
    onTransform?.();
  }, [fitView, onTransform]);

  // ----- Imperative API (same as GraphCanvas) -----
  useEffect(() => {
    if (!onReady) return;
    onReady({
      focusNode: (id, opts = {}) => {
        const fg = fgRef.current;
        const node = simCache.current.get(id);
        if (!fg || !node || node.x == null || node.y == null) return;
        const d = dur(opts.duration ?? 400);
        const z = opts.zoom ? Math.max(fg.zoom(), opts.zoom) : fg.zoom();
        if (opts.zoom) fg.zoom(z, d);
        fg.centerAt(node.x + (opts.offsetX ?? 0) / z, node.y, d);
        kick(d + FADE_MS);
      },
      revealNode: (id, margin, duration) => {
        const fg = fgRef.current;
        const node = simCache.current.get(id);
        if (!fg || !node || node.x == null || node.y == null) return;
        const s = fg.graph2ScreenCoords(node.x, node.y);
        if (s.x < margin || s.y < margin || s.x > width - margin || s.y > height - margin) {
          fg.centerAt(node.x, node.y, dur(duration));
        }
      },
      zoomBy: (factor) => {
        const fg = fgRef.current;
        if (fg) fg.zoom(Math.min(6, Math.max(0.2, fg.zoom() * factor)), dur(200));
      },
      zoomToFit: (d = 400) => {
        const size = fitView(dur(d));
        if (size) lastFit.current = size;
      },
      fitNodes: (ids, d = 300, labelFor) => {
        if (outsideFree(ids, labelFor)) {
          fitView(dur(d), { ids: new Set(ids), noZoomIn: true, labelFor });
        }
      },
      unpinAll: () => undefined,
      nodes: () => graphData.nodes,
      toScreen: (x, y) => fgRef.current?.graph2ScreenCoords(x, y) ?? { x, y },
      isHidden: (id, rightInset) => {
        const fg = fgRef.current;
        const node = simCache.current.get(id);
        if (!fg || !node || node.x == null || node.y == null) return false;
        const s = fg.graph2ScreenCoords(node.x, node.y);
        return s.x > width - rightInset || s.x < 0 || s.y < 0 || s.y > height;
      },
    });
  }, [onReady, dur, width, height, graphData, kick, fitView, outsideFree]);

  return (
    <ForceGraph2D<SimNode, SimLink>
      ref={fgRef}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      nodeId="id"
      nodeVal={(n: SimNode) => (n.r / 4) ** 2}
      nodeRelSize={4}
      nodeLabel={() => ""}
      nodeCanvasObject={nodeCanvasObject}
      nodePointerAreaPaint={nodePointerAreaPaint}
      linkVisibility={false}
      linkHoverPrecision={0}
      enableNodeDrag
      minZoom={0.2}
      maxZoom={6}
      autoPauseRedraw={!animating}
      warmupTicks={reducedMotion ? 150 : 80}
      cooldownTicks={reducedMotion ? 0 : large ? 150 : 300}
      d3AlphaDecay={large ? 0.04 : 0.03}
      d3VelocityDecay={0.4}
      onRenderFramePre={onRenderFramePre}
      onRenderFramePost={onRenderFramePost}
      onZoom={(t) => onTransform?.(t)}
      onNodeHover={(node) => {
        const id = (node?.id as GraphNodeId | undefined) ?? null;
        setHoverId(id);
        onHover?.(id);
      }}
      onNodeClick={(node, event) => onNodeClick?.(node, event)}
      onBackgroundClick={() => onBackgroundClick?.()}
      onNodeDragEnd={(node) => {
        // Not saved in the cosmos view; suns snap back to their spot.
        if (!node.sun) {
          node.fx = undefined;
          node.fy = undefined;
        }
        recomputeNebulae();
      }}
      onEngineTick={fitIfNew}
      onEngineStop={() => {
        fitIfNew();
        recomputeNebulae();
        kick();
        // Re-fit only if the layout spread out noticeably since the last fit.
        const b = boundsOf();
        if (!b || !lastFit.current) return;
        const size = { w: b.x1 - b.x0, h: b.y1 - b.y0 };
        if (grewBeyond(lastFit.current, size)) {
          lastFit.current = fitView(dur(400)) ?? size;
          onTransform?.();
        }
      }}
    />
  );
}
