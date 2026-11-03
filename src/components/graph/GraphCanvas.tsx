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
  GraphNodeType,
  GraphPosition,
} from "@/lib/graph/types";
import { drawLabel, drawNodeShape, drawRing, measureLabel, shapeBottom, withAlpha } from "./draw";
import { forceAxis, forceCollideGrid } from "./forces";
import type { GraphTheme } from "./graph-theme";
import {
  baseRadius,
  buildNeighbors,
  DENSE_GRAPH,
  goalRowY,
  labelPriority,
  labelText,
  labelZoom,
  LARGE_GRAPH,
  nodeRadius,
  type ParaColumn,
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
  fitNodes?: (ids: readonly GraphNodeId[], duration?: number) => void;
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
};

const FADE_MS = 120;

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
              : n.type === "review" || n.type === "tag"
                ? 3.5
                : base;
      } else {
        node.r = nodeRadius(n, n.size, large);
      }
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
      if (!old && mode === "para" && paraX) node.x = paraX[n.type] + (Math.random() - 0.5) * 40;
      next.set(n.id, node);
      return node;
    });
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
      fg.d3Force(
        "paraX",
        forceAxis<SimNode>(
          "x",
          (n) => paraX[n.type as GraphNodeType],
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
  useEffect(() => kick(), [theme, focusId, selectedId, centerId, kick]);

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
    selectedId,
    focusId,
    centerId,
    nodeAlpha,
    large,
    local,
    count,
    hoverId,
  });
  live.current = { theme, selectedId, focusId, centerId, nodeAlpha, large, local, count, hoverId };
  const kRef = useRef(1);

  const nodeCanvasObject = useCallback(
    (node: SimNode, ctx: CanvasRenderingContext2D, k: number) => {
      const L = live.current;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      ctx.globalAlpha = L.nodeAlpha(node);
      drawNodeShape(ctx, node, x, y, node.r, k, L.theme);
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

  // ----- Edges -----
  const restEdgeAlpha = (kind: GraphEdgeKind) =>
    large ? (kind === "belongs" ? 0.4 : 0.14) : kind === "belongs" ? theme.belongsAlpha : 0.22;
  const endId = (end: SimLink["source"]): string =>
    typeof end === "object" && end !== null ? String(end.id) : String(end);
  const edgeAlphaIn = (l: SimLink, e: Emphasis) => {
    const kind = l.kind as GraphEdgeKind;
    if (!e.focus) return restEdgeAlpha(kind);
    const touches = endId(l.source) === e.focus || endId(l.target) === e.focus;
    if (!touches) return 0.04;
    return kind === "belongs" ? 0.85 : 0.6;
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
    return edgeColor(live.current.theme.edge, a);
  }, []);
  const linkWidth = useCallback((l: SimLink) => {
    const base = live.current.large
      ? l.kind === "belongs"
        ? 1
        : 0.75
      : l.kind === "belongs"
        ? 1.5
        : 1;
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

      const tryDraw = (n: SimNode, force: boolean) => {
        if (drawn.has(n.id as string)) return;
        const x = n.x ?? 0;
        const y = n.y ?? 0;
        if (x < tl.x - 200 || x > br.x + 200 || y < tl.y - 50 || y > br.y + 50) return;
        const isStrong = strong.has(n.id as string);
        const emphasised = isStrong || (emph.lit?.has(n.id as GraphNodeId) ?? false);
        if (emph.lit && !emphasised && !force) return; // R: hidden while something is lit
        const text = labelText(n, isStrong || emphasised);
        const weight = isStrong || n.type === "goal" || n.type === "area" ? 500 : 400;
        const top =
          y +
          shapeBottom(n.type, n.r) +
          (n.type === "goal" && n.horizon === "life" ? 2 : 0) +
          3 / k;
        if (dense && !isStrong) {
          const box = measureLabel(ctx, text, x, top, k, weight, L.theme);
          if (boxes.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1))
            return;
          boxes.push(box);
        }
        ctx.globalAlpha = emph.lit && emphasised ? Math.min(1, 0.4 + fadeT) : L.nodeAlpha(n);
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
        if (!dense || isStrong) boxes.push(box);
        drawn.add(n.id as string);
      };

      const byId = simCache.current;
      // 1. selection > hover > keyboard focus > centre, then 2. neighbours, then 3. zoom rules.
      for (const id of [L.selectedId, L.hoverId, L.focusId, L.centerId]) {
        const n = id ? byId.get(id) : undefined;
        if (n) tryDraw(n, true);
      }
      if (emph.lit)
        for (const id of emph.lit) {
          const n = byId.get(id);
          if (n) tryDraw(n, true);
        }
      let budget = 400;
      for (const n of labelOrderRef.current) {
        if (budget <= 0) break;
        let show: boolean;
        if (L.local) show = L.count <= 25 || n.dist === 0 || n.dist === 1;
        else show = k >= labelZoom(n, L.count);
        if (!show) continue;
        tryDraw(n, false);
        budget--;
      }
      ctx.globalAlpha = 1;
    },

    [width, height],
  );

  /**
   * zoomToFit with a zoom cap, so a handful of nodes is not blown up to the max zoom.
   * Padding: 48s (24s local) plus the largest node radius.
   */
  const fitView = useCallback(
    (duration: number) => {
      const fg = fgRef.current;
      if (!fg || graphData.nodes.length === 0) return;
      const box = fg.getGraphBbox();
      const maxR = graphData.nodes.reduce((m, n) => Math.max(m, n.r), 0) + 12;
      const pad = local ? 24 : 48;
      const w = box.x[1] - box.x[0] + maxR * 2;
      const h = box.y[1] - box.y[0] + maxR * 2;
      const k = Math.max(
        0.2,
        Math.min(
          local ? 2 : 2.5,
          (width - pad * 2) / Math.max(w, 1),
          (height - pad * 2) / Math.max(h, 1),
        ),
      );
      fg.zoom(k, duration);
      fg.centerAt((box.x[0] + box.x[1]) / 2, (box.y[0] + box.y[1]) / 2, duration);
    },
    [graphData, local, width, height],
  );

  // ----- Fit on first settle and after filter changes -----
  const pendingFit = useRef(true);
  useEffect(() => {
    pendingFit.current = true;
  }, [fitKey, mode]);
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
        local ? (e: MouseEvent) => e.type !== "wheel" || e.ctrlKey || e.metaKey : true
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
      onZoom={() => onTransform?.()}
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
      onEngineStop={() => {
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
