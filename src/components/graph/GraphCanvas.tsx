"use client";

/**
 * Force-directed graph canvas on react-force-graph-2d, drawn by `docs/design/graph.md`.
 * Client only — load through `GraphCanvasLazy` (next/dynamic, ssr: false).
 *
 * Hot paths (per-frame accessors) read from refs so hover/selection changes do not rebuild
 * props; a short "kick" disables auto-pause so the canvas repaints during the 120ms fade.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject,
} from "react-force-graph-2d";
import type {
  GraphData,
  GraphEdgeKind,
  GraphNode,
  GraphNodeId,
  GraphPosition,
} from "@/lib/graph/types";
import type { GraphColorBy } from "@/lib/graph/color";
import {
  drawLabel,
  drawNodeShape,
  drawRing,
  LABEL_BELOW_PX,
  measureCtx,
  measureLabel,
  nodeColor,
  quarterGoalFill,
  withAlpha,
} from "./draw";
import {
  armRefit,
  DISARMED,
  EARLY_FIT_TICKS,
  fitTransform,
  grewBeyond,
  noteTransform,
  overflowsArea,
  refitOnStop,
  type RefitGuard,
  seedNear,
  type Box,
  type FitItem,
} from "./fit";
import { forceAxis, forceCollideGrid } from "./forces";
import type { GraphTheme } from "./graph-theme";
import {
  allowLocalZoomEvent,
  baseRadius,
  buildNeighbors,
  byLabelPriority,
  DENSE_GRAPH,
  fitLabel,
  goalRowY,
  labelPriority,
  labelText,
  labelZoom,
  LARGE_GRAPH,
  nodeRadius,
  type ParaColumn,
  paraTargetX,
  paraXByType,
} from "./model";

export type GraphLayoutMode = "free" | "para";

type SimNode = NodeObject<GraphNode & { r: number; dist?: number }>;
type SimLink = LinkObject<SimNode, { kind: GraphEdgeKind }>;

export type GraphCanvasApi = {
  /** Centre on a node (and zoom in to at least `zoom`). `offsetX` shifts the target left in screen px. */
  focusNode: (
    id: GraphNodeId,
    opts?: { zoom?: number; offsetX?: number; duration?: number },
  ) => void;
  /** Centre only if the node is within `margin` px of the edge or outside. */
  revealNode: (id: GraphNodeId, margin: number, duration: number) => void;
  zoomBy: (factor: number) => void;
  zoomToFit: (duration?: number) => void;
  /** Cosmos view: if any of these nodes is outside the free area, fit them (never zooms in). */
  fitNodes?: (ids: readonly GraphNodeId[], duration?: number, labelFor?: GraphNodeId) => void;
  /** Releases every pinned node and restarts the layout. */
  unpinAll: () => void;
  /** Current simulated nodes (positions in graph units). */
  nodes: () => readonly SimNode[];
  toScreen: (x: number, y: number) => { x: number; y: number };
  isHidden: (id: GraphNodeId, rightInset: number) => boolean;
};

export type GraphCanvasProps = {
  data: GraphData;
  theme: GraphTheme;
  /** Node color basis (design 1.2 / 1.3). The local graph always uses `kind`. */
  colorBy?: GraphColorBy;
  /** Area palette slot per node (`assignAreaSlots`), for `colorBy="area"`. */
  areaSlots?: ReadonlyMap<GraphNodeId, number | null> | null;
  reducedMotion: boolean;
  width: number;
  height: number;
  variant?: "full" | "local";
  mode?: GraphLayoutMode;
  /** PARA columns for the shown types. */
  columns?: readonly ParaColumn[];
  /** Saved positions (pinned in the free layout). */
  positions?: readonly GraphPosition[];
  selectedId?: GraphNodeId | null;
  /** Keyboard focus. */
  focusId?: GraphNodeId | null;
  /** Local graph: the current item. */
  centerId?: GraphNodeId | null;
  /** Local graph: step distance from the centre per node. */
  distances?: ReadonlyMap<GraphNodeId, number>;
  /** Changing this re-fits the view when the layout next settles (filter changes). */
  fitKey?: string;
  /** On the first settle, centre this node instead of fitting the whole graph (`?focus=`). */
  focusOnSettle?: GraphNodeId | null;
  onNodeClick?: (node: GraphNode, event: MouseEvent) => void;
  onBackgroundClick?: () => void;
  onHover?: (id: GraphNodeId | null) => void;
  /** Free layout only: a node was dragged to a new place. */
  onPin?: (position: GraphPosition) => void;
  onReady?: (api: GraphCanvasApi) => void;
  /** Pan/zoom changed (PARA column titles follow it). */
  onTransform?: () => void;
  /** Local graph: whether the plain mouse wheel zooms right now (see `allowLocalZoomEvent`). */
  wheelZoom?: () => boolean;
};

const FADE_MS = 120;
/** Obsidian-like small dots: model radii are scaled down for drawing. */
const DOT_SCALE = 0.7;

// Per-frame edge colors: alpha rounded to 1/100 and cached, so thousands of links do not
// build a new rgba string every frame.
const edgeColorCache = new Map<string, string>();
function edgeColor(base: string, alpha: number): string {
  const key = `${base}|${Math.round(alpha * 100)}`;
  let color = edgeColorCache.get(key);
  if (!color) {
    color = withAlpha(base, Math.round(alpha * 100) / 100);
    edgeColorCache.set(key, color);
  }
  return color;
}

type Emphasis = { lit: Set<GraphNodeId> | null; focus: GraphNodeId | null };

export default function GraphCanvas(props: GraphCanvasProps) {
  const {
    data,
    theme,
    colorBy = "kind",
    areaSlots,
    reducedMotion,
    width,
    height,
    variant = "full",
    mode = "free",
    columns,
    positions,
    selectedId = null,
    focusId = null,
    centerId = null,
    distances,
    fitKey = "",
    focusOnSettle = null,
    onNodeClick,
    onBackgroundClick,
    onHover,
    onPin,
    onReady,
    onTransform,
    wheelZoom,
  } = props;
  const local = variant === "local";
  const fgRef = useRef<ForceGraphMethods<SimNode, SimLink> | undefined>(undefined);
  const simCache = useRef(new Map<string, SimNode>());
  const [hoverId, setHoverId] = useState<GraphNodeId | null>(null);
  const [animating, setAnimating] = useState(false);
  const kTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const count = data.nodes.length;
  const large = count > LARGE_GRAPH;
  const neighbors = useMemo(() => buildNeighbors(data.edges), [data.edges]);

  // ----- Colors (1.2–1.5): recomputed on theme/basis change without touching the layout -----
  const colors = useMemo(() => {
    const out = new Map<string, string>();
    for (const n of data.nodes)
      out.set(n.id, nodeColor(n.type, colorBy, areaSlots?.get(n.id), theme));
    return out;
  }, [data.nodes, colorBy, areaSlots, theme]);
  const quarterFill = quarterGoalFill(colorBy, theme);

  // ----- Simulation data (keeps coordinates across filter changes) -----
  const graphData = useMemo(() => {
    const saved = new Map((positions ?? []).map((p) => [p.node, p]));
    const prev = simCache.current;
    const next = new Map<string, SimNode>();
    const paraX = columns ? paraXByType(columns) : null;
    const nodes = data.nodes.map((n) => {
      const old = prev.get(n.id);
      const node: SimNode = old ? Object.assign(old, n) : { ...n, r: 0 };
      const dist = distances?.get(n.id);
      node.dist = dist;
      if (local) {
        const base = baseRadius(n);
        node.r =
          n.id === centerId
            ? 8
            : dist === 1
              ? Math.min(nodeRadius({ ...n }, n.size) + 1, 10)
              : n.type === "review" || n.type === "tag" || n.type === "task"
                ? nodeRadius(n, 0)
                : base;
      } else {
        node.r = nodeRadius(n, n.size, large);
      }
      node.r = Math.max(2.5, node.r * DOT_SCALE);
      const pin = mode === "free" && !local ? saved.get(n.id) : undefined;
      if (!old && pin) {
        node.x = pin.x;
        node.y = pin.y;
      }
      if (pin) {
        node.fx = pin.x;
        node.fy = pin.y;
      } else if (old && mode === "para") {
        node.fx = undefined;
        node.fy = undefined;
      }
      if (!old && mode === "para" && paraX)
        node.x = paraTargetX(n, paraX) + (Math.random() - 0.5) * 40;
      next.set(n.id, node);
      return node;
    });
    // New nodes (a type switched on) start beside a linked node that is already placed.
    if (prev.size > 0 && mode === "free") {
      for (const node of nodes) {
        if (prev.has(node.id) || node.x != null) continue;
        const seed = seedNear(node.id, data.edges, prev);
        if (seed) Object.assign(node, seed);
      }
    }
    simCache.current = next;
    const links: SimLink[] = data.edges.map((e) => ({
      source: e.source,
      target: e.target,
      kind: e.kind,
    }));
    // Positions only seed / pin; they are read once per data/mode change.
    return { nodes, links };
  }, [data, positions, mode, columns, local, centerId, distances, large]);

  // ----- Forces -----
  const centerForce = useRef<unknown>(undefined);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (centerForce.current === undefined) centerForce.current = fg.d3Force("center") ?? null;
    const charge = fg.d3Force("charge");
    const link = fg.d3Force("link");
    if (mode === "para" && columns && !local) {
      const paraX = paraXByType(columns);
      charge?.strength?.(-30);
      link?.distance?.((l: SimLink) => (l.kind === "belongs" ? 40 : 60));
      link?.strength?.(0.05);
      fg.d3Force("center", null);
      fg.d3Force("pullX", null);
      fg.d3Force("pullY", null);
      fg.d3Force(
        "paraX",
        forceAxis<SimNode>(
          "x",
          (n) => paraTargetX(n, paraX),
          () => 1,
        ),
      );
      fg.d3Force(
        "paraY",
        forceAxis<SimNode>(
          "y",
          (n) => (n.type === "goal" ? goalRowY(n.horizon) : 0),
          (n) => (n.type === "goal" ? 0.3 : 0.04),
        ),
      );
      fg.d3Force(
        "collide",
        forceCollideGrid<SimNode>((n) => n.r + 6),
      );
    } else {
      charge?.strength?.(local ? -80 : -60);
      charge?.distanceMax?.(large ? 300 : Infinity);
      link?.distance?.((l: SimLink) => (l.kind === "belongs" ? 40 : 60));
      // d3 default link strength (1 / min degree) — reset after PARA.
      link?.strength?.((l: SimLink) => {
        const s = l.source as SimNode;
        const t = l.target as SimNode;
        return (
          1 /
          Math.max(
            1,
            Math.min(
              neighbors.get(s.id as GraphNodeId)?.size ?? 1,
              neighbors.get(t.id as GraphNodeId)?.size ?? 1,
            ),
          )
        );
      });
      if (centerForce.current) fg.d3Force("center", centerForce.current as never);
      // Weak pull to the middle: without it the layout hollows out and drifts to the edges.
      fg.d3Force("pullX", local ? null : forceAxis<SimNode>("x", () => 0, () => 0.06));
      fg.d3Force("pullY", local ? null : forceAxis<SimNode>("y", () => 0, () => 0.06));
      fg.d3Force("paraX", null);
      fg.d3Force("paraY", null);
      fg.d3Force(
        "collide",
        forceCollideGrid<SimNode>((n) => n.r + 4),
      );
    }
    fg.d3ReheatSimulation();
  }, [graphData, mode, columns, local, large, neighbors]);

  // ----- Emphasis (hover beats selection; 120ms fade) -----
  const emphasisFor = useCallback(
    (id: GraphNodeId | null): Emphasis => {
      if (!id) return { lit: null, focus: null };
      const lit = new Set<GraphNodeId>(neighbors.get(id) ?? []);
      lit.add(id);
      return { lit, focus: id };
    },
    [neighbors],
  );
  const activeId = hoverId ?? selectedId;
  const fade = useRef<{ from: Emphasis; to: Emphasis; start: number }>({
    from: { lit: null, focus: null },
    to: { lit: null, focus: null },
    start: 0,
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

  useEffect(() => {
    const now = performance.now();
    const f = fade.current;
    f.from = f.to;
    f.to = emphasisFor(activeId);
    f.start = instant ? now - FADE_MS : now;
    kick();
  }, [activeId, emphasisFor, instant, kick]);

  // Other visual inputs: repaint once.
  useEffect(() => kick(), [theme, colors, focusId, selectedId, centerId, kick]);

  /** 0..1 progress of the current fade. */
  const progress = () => {
    const t = (performance.now() - fade.current.start) / FADE_MS;
    return t >= 1 ? 1 : t <= 0 ? 0 : t;
  };

  const restAlpha = (n: SimNode) => (n.archived ? 0.45 : local && n.dist === 2 ? 0.55 : 1);
  const alphaIn = (n: SimNode, e: Emphasis) =>
    !e.lit || e.lit.has(n.id as GraphNodeId) ? restAlpha(n) : theme.dimAlpha;
  const nodeAlpha = (n: SimNode) => {
    const t = progress();
    const { from, to } = fade.current;
    return t >= 1 ? alphaIn(n, to) : alphaIn(n, from) * (1 - t) + alphaIn(n, to) * t;
  };

  // Refs for per-frame accessors.
  const live = useRef({
    theme,
    colors,
    quarterFill,
    selectedId,
    focusId,
    centerId,
    nodeAlpha,
    large,
    local,
    count,
    hoverId,
  });
  live.current = {
    theme,
    colors,
    quarterFill,
    selectedId,
    focusId,
    centerId,
    nodeAlpha,
    large,
    local,
    count,
    hoverId,
  };
  const kRef = useRef(1);

  const nodeCanvasObject = useCallback(
    (node: SimNode, ctx: CanvasRenderingContext2D, k: number) => {
      const L = live.current;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      ctx.globalAlpha = L.nodeAlpha(node);
      const color = L.colors.get(node.id as string) ?? L.theme.neutral;
      drawNodeShape(ctx, node, x, y, node.r, k, L.theme, color, L.quarterFill);
      const id = node.id as GraphNodeId;
      if (id === L.selectedId || id === L.focusId || id === L.centerId) {
        ctx.globalAlpha = 1;
        drawRing(ctx, node.type, x, y, node.r, k, L.theme);
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

  // ----- Edges (1.5: source node's color, low alpha) -----
  const restEdgeAlpha = (kind: GraphEdgeKind) =>
    large
      ? kind === "belongs"
        ? 0.35
        : 0.14
      : kind === "belongs"
        ? theme.belongsAlpha
        : theme.linkAlpha;
  const endId = (end: SimLink["source"]): string =>
    typeof end === "object" && end !== null ? String(end.id) : String(end);
  const edgeAlphaIn = (l: SimLink, e: Emphasis) => {
    const kind = l.kind as GraphEdgeKind;
    if (!e.focus) return restEdgeAlpha(kind);
    const touches = endId(l.source) === e.focus || endId(l.target) === e.focus;
    if (!touches) return 0.03;
    return 0.75;
  };
  const edgeFns = useRef({ edgeAlphaIn, restEdgeAlpha });
  edgeFns.current = { edgeAlphaIn, restEdgeAlpha };

  const linkColor = useCallback((l: SimLink) => {
    const t = progress();
    const { from, to } = fade.current;
    const a =
      t >= 1
        ? edgeFns.current.edgeAlphaIn(l, to)
        : edgeFns.current.edgeAlphaIn(l, from) * (1 - t) + edgeFns.current.edgeAlphaIn(l, to) * t;
    const L = live.current;
    return edgeColor(L.theme.edge, a);
  }, []);
  const linkWidth = useCallback((l: SimLink) => {
    const base = live.current.large
      ? l.kind === "belongs"
        ? 0.8
        : 0.6
      : l.kind === "belongs"
        ? 0.9
        : 0.7;
    const f = fade.current.to.focus;
    const touches = f && (endId(l.source) === f || endId(l.target) === f);
    return touches ? base + 0.5 : base;
  }, []);
  const linkLineDash = useCallback(
    (l: SimLink) => (l.kind === "topic" ? [2 / kRef.current, 3 / kRef.current] : null),
    [],
  );

  // ----- Frame hooks: PARA dividers (pre) and labels (post) -----
  const columnsRef = useRef(columns);
  columnsRef.current = mode === "para" && !local ? columns : undefined;

  const onRenderFramePre = useCallback((ctx: CanvasRenderingContext2D, k: number) => {
    kRef.current = k;
    const cols = columnsRef.current;
    const fg = fgRef.current;
    if (!cols || cols.length < 2 || !fg) return;
    const top = fg.screen2GraphCoords(0, 0).y;
    const bottom = fg.screen2GraphCoords(0, 100000).y;
    ctx.save();
    ctx.strokeStyle = live.current.theme.divider;
    ctx.lineWidth = 1 / k;
    ctx.beginPath();
    for (let i = 1; i < cols.length; i++) {
      const x = (cols[i - 1]!.x + cols[i]!.x) / 2;
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    ctx.stroke();
    ctx.restore();
  }, []);

  // Static label order: goal > area > project > rest, bigger first.
  const labelOrder = useMemo(
    () =>
      [...graphData.nodes].sort(
        (a, b) => labelPriority(a.type) - labelPriority(b.type) || b.size - a.size,
      ),
    [graphData],
  );
  const labelOrderRef = useRef(labelOrder);
  labelOrderRef.current = labelOrder;
  const emphasisRef = useRef<() => Emphasis>(() => fade.current.to);

  const onRenderFramePost = useCallback(
    (ctx: CanvasRenderingContext2D, k: number) => {
      const L = live.current;
      const fg = fgRef.current;
      if (!fg) return;
      const tl = fg.screen2GraphCoords(0, 0);
      const br = fg.screen2GraphCoords(width, height);
      const emph = emphasisRef.current();
      const dense = L.count > DENSE_GRAPH;
      const strong = new Set<string>(
        [emph.focus, L.selectedId, L.focusId, L.centerId, L.hoverId].filter(Boolean) as string[],
      );
      const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
      const drawn = new Set<string>();
      const fadeT = progress();

      const tryDraw = (n: SimNode, force: boolean, zoomFade = 1) => {
        if (drawn.has(n.id as string)) return;
        const x = n.x ?? 0;
        const y = n.y ?? 0;
        if (x < tl.x - 200 || x > br.x + 200 || y < tl.y - 50 || y > br.y + 50) return;
        const isStrong = strong.has(n.id as string);
        const emphasised = isStrong || (emph.lit?.has(n.id as GraphNodeId) ?? false);
        if (emph.lit && !emphasised && !force) return; // R: hidden while something is lit
        const weight = isStrong || n.type === "goal" || n.type === "area" ? 500 : 400;
        const top =
          y +
          n.r +
          (n.type === "goal" && n.horizon === "life" ? 2 : 0) +
          3 / k;
        let text = labelText(n, isStrong || emphasised);
        // Skip (or shorten) labels that would overlap one already drawn: in dense graphs, and
        // for the neighbours lit by a selection or hover. Strong labels are always drawn.
        if ((dense || emph.lit) && !isStrong) {
          const texts = emphasised ? [text, labelText(n, false)] : [text];
          const pick = fitLabel(
            texts.map((t) => measureLabel(ctx, t, x, top, k, weight, L.theme)),
            boxes,
            2 / k,
          );
          if (pick < 0) return;
          text = texts[pick]!;
        }
        ctx.globalAlpha =
          (emph.lit && emphasised ? Math.min(1, 0.4 + fadeT) : L.nodeAlpha(n)) *
          (isStrong || emphasised ? 1 : zoomFade);
        const box = drawLabel(
          ctx,
          text,
          x,
          top,
          k,
          isStrong ? L.theme.labelStrong : L.theme.label,
          weight,
          L.theme,
        );
        boxes.push(box);
        drawn.add(n.id as string);
      };

      const byId = simCache.current;
      // 1. selection > hover > keyboard focus > centre, then 2. neighbours, then 3. zoom rules.
      for (const id of [L.selectedId, L.hoverId, L.focusId, L.centerId]) {
        const n = id ? byId.get(id) : undefined;
        if (n) tryDraw(n, true);
      }
      if (emph.lit) {
        const lit: SimNode[] = [];
        for (const id of emph.lit) {
          const n = byId.get(id);
          if (n) lit.push(n);
        }
        for (const n of byLabelPriority(lit)) tryDraw(n, true);
      }
      let budget = 400;
      for (const n of labelOrderRef.current) {
        if (budget <= 0) break;
        let show: boolean;
        if (L.local) show = L.count <= 25 || n.dist === 0 || n.dist === 1;
        else show = k >= labelZoom(n, L.count);
        if (!show) continue;
        // Labels fade in over 0.5 of zoom after their threshold (clearer as you zoom in).
        const zoomFade = L.local ? 1 : Math.min(1, 0.5 + (k - labelZoom(n, L.count)) / 0.5);
        tryDraw(n, false, zoomFade);
        budget--;
      }
      ctx.globalAlpha = 1;
    },

    [width, height],
  );

  /**
   * zoomToFit with a zoom cap, so a handful of nodes is not blown up to the max zoom.
   * Fits every node's shape *and* its label (screen-size text below it), so the bottom row
   * and long labels at the edges stay on screen. Padding 32px (12px local).
   */
  const fitItems = useCallback((): FitItem[] => {
    const ctx = measureCtx();
    const items: FitItem[] = [];
    for (const n of graphData.nodes) {
      if (n.x == null || n.y == null) continue;
      const weight = n.type === "goal" || n.type === "area" ? 500 : 400;
      ctx.font = `${weight} 12px ${theme.fontFamily}`;
      items.push({
        x: n.x,
        y: n.y,
        side: n.r,
        top: n.r,
        bottom: n.r + (n.type === "goal" ? 2 : 0),
        labelW: ctx.measureText(labelText(n, false)).width + 3,
        labelH: LABEL_BELOW_PX,
      });
    }
    return items;
  }, [graphData, theme.fontFamily]);
  const fitPad = local ? 12 : 32;
  const bottomGap = local ? 0 : 40;

  const fitView = useCallback(
    (duration: number) => {
      const fg = fgRef.current;
      if (!fg) return;
      const t = fitTransform(fitItems(), {
        width,
        height: height - bottomGap,
        pad: fitPad,
        minZoom: 0.2,
        maxZoom: local ? 2 : 2.5,
      });
      if (!t) return;
      fg.zoom(t.k, duration);
      // The view centre sits half the gap lower, so the spare room ends up below the drawing.
      fg.centerAt(t.cx, t.cy + bottomGap / 2 / t.k, duration);
    },
    [fitItems, fitPad, local, width, height, bottomGap],
  );

  /** True when part of the drawing is off screen at the current zoom and centre. */
  const offScreen = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return false;
    const c = fg.centerAt();
    return overflowsArea(fitItems(), { k: fg.zoom(), cx: c.x, cy: c.y }, { width, height });
  }, [fitItems, width, height]);

  // ----- Fit on first settle and after filter changes -----
  // First load: fit when the simulation stops (focus may take over). After a filter change
  // (cosmos.md 4절, same rule): fit shortly after the new data arrives instead of waiting
  // seconds for it to settle, then refit on stop only if the graph grew by more than 15%.
  const pendingFit = useRef(true);
  const loadedOnce = useRef(false);
  const earlyFit = useRef<{ data: unknown; ticks: number } | null>(null);
  const earlyBox = useRef<Box | null>(null);
  /** May the next stop refit a drawing that drifted off screen (see `RefitGuard`)? */
  const refitGuard = useRef<RefitGuard>(DISARMED);
  const graphDataRef = useRef(graphData);
  graphDataRef.current = graphData;
  useEffect(() => {
    pendingFit.current = true;
    earlyBox.current = null;
    // Waits for data newer than what is on screen now.
    earlyFit.current = loadedOnce.current
      ? { data: graphDataRef.current, ticks: -1 }
      : local
        ? { data: graphDataRef.current, ticks: 0 } // local: no cropped first frames
        : null;
  }, [fitKey, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const onEngineTick = () => {
    const early = earlyFit.current;
    if (!early) return;
    if (early.ticks < 0) {
      if (graphDataRef.current === early.data) return;
      early.data = graphDataRef.current;
      early.ticks = 0;
    }
    if (++early.ticks < EARLY_FIT_TICKS) return;
    earlyFit.current = null;
    const fg = fgRef.current;
    if (!fg) return;
    fitView(fitDuration);
    earlyBox.current = fg.getGraphBbox();
    refitGuard.current = armRefit(performance.now(), fitDuration);
    pendingFit.current = false;
    onTransform?.();
  };
  const fitDuration = reducedMotion ? 0 : 400;
  const focusUsed = useRef(false);

  // ----- Imperative API -----
  useEffect(() => {
    if (!onReady) return;
    const dur = (d: number) => (reducedMotion ? 0 : d);
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
      zoomToFit: (d = 400) => fitView(dur(d)),
      unpinAll: () => {
        for (const node of simCache.current.values()) {
          node.fx = undefined;
          node.fy = undefined;
        }
        fgRef.current?.d3ReheatSimulation();
      },
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
  }, [onReady, reducedMotion, width, height, graphData, local, kick, fitView]);

  return (
    <ForceGraph2D<SimNode, SimLink>
      ref={fgRef}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor={theme.canvasBg}
      nodeId="id"
      nodeVal={(n: SimNode) => (n.r / 4) ** 2}
      nodeRelSize={4}
      nodeLabel={() => ""}
      nodeCanvasObject={nodeCanvasObject}
      nodePointerAreaPaint={nodePointerAreaPaint}
      linkColor={linkColor}
      linkWidth={linkWidth}
      linkLineDash={linkLineDash}
      linkHoverPrecision={0}
      enableNodeDrag
      enableZoomInteraction={
        local ? (e: MouseEvent) => allowLocalZoomEvent(e, wheelZoom?.() ?? false) : true
      }
      minZoom={0.2}
      maxZoom={6}
      autoPauseRedraw={!animating}
      warmupTicks={reducedMotion ? 120 : large ? 60 : 0}
      cooldownTicks={large ? 150 : 300}
      d3AlphaDecay={large ? 0.04 : 0.0228}
      d3VelocityDecay={0.4}
      onRenderFramePre={onRenderFramePre}
      onRenderFramePost={onRenderFramePost}
      onZoom={() => {
        refitGuard.current = noteTransform(refitGuard.current, performance.now());
        onTransform?.();
      }}
      onNodeDrag={() => {
        refitGuard.current = DISARMED;
      }}
      onNodeHover={(node) => {
        const id = (node?.id as GraphNodeId | undefined) ?? null;
        setHoverId(id);
        onHover?.(id);
      }}
      onNodeClick={(node, event) => onNodeClick?.(node, event)}
      onBackgroundClick={() => onBackgroundClick?.()}
      onNodeDragEnd={(node) => {
        if (mode !== "free" || local || node.x == null || node.y == null) return;
        node.fx = node.x;
        node.fy = node.y;
        onPin?.({ node: node.id as GraphNodeId, x: node.x, y: node.y });
      }}
      onEngineTick={onEngineTick}
      onEngineStop={() => {
        loadedOnce.current = true;
        const box = earlyBox.current;
        const stop = refitOnStop(refitGuard.current, offScreen);
        refitGuard.current = stop.next;
        earlyBox.current = null;
        // Refit when the layout grew noticeably or drifted partly off screen since the fit.
        if (box && fgRef.current && (grewBeyond(box, fgRef.current.getGraphBbox()) || stop.refit)) {
          fitView(fitDuration);
          onTransform?.();
          return;
        }
        if (!pendingFit.current) return;
        pendingFit.current = false;
        const fg = fgRef.current;
        const target =
          !focusUsed.current && focusOnSettle ? simCache.current.get(focusOnSettle) : undefined;
        focusUsed.current = true;
        if (fg && target?.x != null && target.y != null) {
          fg.zoom(2, fitDuration);
          fg.centerAt(target.x + 168 / 2, target.y, fitDuration);
        } else {
          fitView(local ? 0 : fitDuration);
        }
        onTransform?.();
      }}
    />
  );
}
