"use client";

/**
 * `/graph` screen (docs/design/graph.md 6–7, 9–11): top bar, filter bar, force canvas with
 * PARA columns, node search, preview panel, keyboard navigation. Client only.
 * `[기본 | ✦ 우주]` switches to the cosmos view (docs/design/cosmos.md): its own canvas,
 * star field, side panel and "왜 중요한가" preview, with the same keyboard and search.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { confirmLeave } from "@/components/fields/unsaved-guard";
import { GRAPH_SEARCH_EVENT } from "@/components/shell/shortcuts";
import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Kbd } from "@/components/ui/Kbd";
import { Spinner } from "@/components/ui/Spinner";
import { constellationPath } from "@/lib/cosmos/path";
import { withStar } from "@/lib/cosmos/star-patch";
import type { CosmosResponse } from "@/lib/cosmos/types";
import type { GraphFilter, GraphNode, GraphNodeId, GraphPosition } from "@/lib/graph/types";
import { fetchCosmos, fetchGraph, type GraphLoad, resetLayout, saveLayout, setStar } from "./api";
import { CosmosPanel, useCosmosPanelCollapsed } from "./CosmosPanel";
import { freeArea } from "./cosmos-model";
import { createLayoutSaver } from "./layout-saver";
import type { GraphCanvasApi } from "./GraphCanvas";
import { CosmosCanvasLazy, GraphCanvasLazy } from "./GraphCanvasLazy";
import { type FilterOptions, GraphFilterControls } from "./GraphFilterBar";
import { GraphPreview } from "./GraphPreview";
import { GraphSearch } from "./GraphSearch";
import { COSMOS_THEME, useGraphTheme, useReducedMotion } from "./graph-theme";
import {
  activeFilterCount,
  buildNeighbors,
  cycleNeighbor,
  type Direction,
  goalLabel,
  GRAPH_MODE_STORAGE_KEY,
  type GraphMode,
  graphQuery,
  GRAPH_TYPE_LABEL,
  type GraphView as ViewMode,
  initialFocus,
  isDefaultFilter,
  LARGE_GRAPH,
  nodeHref,
  nodeInDirection,
  pageQuery,
  paraColumns,
  parsePageQuery,
  shownTypes,
} from "./model";
import { StarField } from "./StarField";
import { useElementSize } from "./use-element-size";

const PANEL_OFFSET = 168; // (320 + 16) / 2: keeps the selected node clear of the preview.
const NARROW = 900;
const LARGE_NOTICE_KEY = "rb-graph-large-notice";

type Loaded = GraphLoad & Partial<Omit<CosmosResponse, keyof GraphLoad>>;
type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: Loaded };

/** Cosmos data when this load came from `/api/graph/cosmos`. */
function asCosmos(data: Loaded | null): CosmosResponse | null {
  return data?.cosmos && data.galaxies && data.top && data.lonely && data.neglected
    ? (data as CosmosResponse)
    : null;
}

function typeLabel(node: GraphNode): string {
  return node.type === "goal" ? goalLabel(node) : GRAPH_TYPE_LABEL[node.type];
}

export default function GraphView({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const theme = useGraphTheme();
  const reducedMotion = useReducedMotion();
  const initial = useMemo(
    () =>
      parsePageQuery(
        new URLSearchParams(typeof window === "undefined" ? "" : window.location.search),
      ),
    [],
  );
  const [filter, setFilter] = useState<GraphFilter>(initial.filter);
  const [view, setView] = useState<ViewMode>(initial.view);
  const [graphMode, setGraphMode] = useState<GraphMode>(
    () =>
      initial.mode ??
      (typeof window !== "undefined" && localStorage.getItem(GRAPH_MODE_STORAGE_KEY) === "cosmos"
        ? "cosmos"
        : "basic"),
  );
  const cosmosMode = graphMode === "cosmos";
  const [externalHover, setExternalHover] = useState<GraphNodeId | null>(null);
  const [starBusy, setStarBusy] = useState(false);
  const panRef = useRef({ x: 0, y: 0 });
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const loadRef = useRef(load);
  loadRef.current = load;
  const [showSpinner, setShowSpinner] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [positions, setPositions] = useState<GraphPosition[]>([]);
  const pins = useRef(new Map<GraphNodeId, GraphPosition>());
  const [selectedId, setSelectedId] = useState<GraphNodeId | null>(initial.focus);
  const [focusId, setFocusId] = useState<GraphNodeId | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [largeDismissed, setLargeDismissed] = useState(false);
  const [, setTransformTick] = useState(0);
  const apiRef = useRef<GraphCanvasApi | null>(null);
  const [rootRef, rootSize] = useElementSize<HTMLDivElement>();
  const [canvasRef, canvasSize] = useElementSize<HTMLDivElement>();
  const narrow = rootSize.width > 0 && rootSize.width < NARROW;
  const [panelCollapsed, togglePanel] = useCosmosPanelCollapsed(narrow);
  /** Cosmos camera move to run after the render that opens the preview (insets change). */
  const pendingCamera = useRef<{ id: GraphNodeId; zoom?: number } | null>(null);

  useEffect(() => {
    setLargeDismissed(sessionStorage.getItem(LARGE_NOTICE_KEY) === "1");
  }, []);

  // ----- Data -----
  useEffect(() => {
    const controller = new AbortController();
    setLoad((prev) => (prev.status === "ready" ? prev : { status: "loading" }));
    const spinner = setTimeout(() => setShowSpinner(true), 300);
    const request: Promise<Loaded> = cosmosMode
      ? fetchCosmos(filter, controller.signal).then((d) => ({ ...d, mock: false }))
      : fetchGraph(filter, controller.signal);
    request
      .then((data) => {
        pins.current = new Map(data.positions.map((p) => [p.node, p]));
        setPositions(data.positions);
        setLoad({ status: "ready", data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: "error" });
      })
      .finally(() => {
        clearTimeout(spinner);
        setShowSpinner(false);
      });
    return () => {
      controller.abort();
      clearTimeout(spinner);
    };
  }, [filter, reloadKey, cosmosMode]);

  // URL mirrors filter/view/selection (refresh and share keep the view).
  useEffect(() => {
    const params = new URLSearchParams(
      pageQuery({ filter, view, focus: selectedId, mode: graphMode }),
    );
    // Keep the performance-check mock (`?mock=<n>`) across filter changes.
    const mock = new URLSearchParams(window.location.search).get("mock");
    if (mock) params.set("mock", mock);
    const q = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${q ? `?${q}` : ""}`,
    );
  }, [filter, view, selectedId, graphMode]);

  const data = load.status === "ready" ? load.data : null;
  // The canvas switches only once data of the matching kind has arrived.
  const cosmosData = cosmosMode ? asCosmos(data) : null;
  const nodes = useMemo(() => data?.nodes ?? [], [data]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const neighbors = useMemo(() => buildNeighbors(data?.edges ?? []), [data]);
  const columns = useMemo(() => paraColumns(shownTypes(filter)), [filter]);
  const large = nodes.length > LARGE_GRAPH;
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  // Drop a selection that the new data no longer has.
  useEffect(() => {
    if (!data) return;
    if (selectedId && !byId.has(selectedId)) setSelectedId(null);
    if (focusId && !byId.has(focusId)) setFocusId(null);
  }, [data, byId, selectedId, focusId]);

  // ----- Layout saving: batched, one PUT at a time, flushed with keepalive on leave -----
  const mockRef = useRef(false);
  mockRef.current = !!data?.mock;
  const saver = useMemo(
    () =>
      createLayoutSaver((batch, opts) => saveLayout(batch, mockRef.current, opts), {
        onResult: (ok) => setSaveError(!ok),
      }),
    [],
  );
  const onPin = useCallback(
    (p: GraphPosition) => {
      pins.current.set(p.node, p);
      saver.add(p);
    },
    [saver],
  );
  useEffect(() => {
    const leave = () => saver.flushNow();
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      saver.flushNow();
      saver.dispose();
    };
  }, [saver]);

  function changeView(next: ViewMode) {
    if (next === view) return;
    // Hand the canvas the latest pins so the free layout restores them.
    setPositions([...pins.current.values()]);
    setView(next);
  }

  function changeMode(next: GraphMode) {
    if (next === graphMode) return;
    if (next === "basic") setPositions([...pins.current.values()]);
    setGraphMode(next);
    localStorage.setItem(GRAPH_MODE_STORAGE_KEY, next);
    setAnnounce(next === "cosmos" ? "우주 보기" : "기본 보기");
  }

  async function confirmReset() {
    setResetOpen(false);
    try {
      // Drop queued drags and wait for an in-flight PUT so it cannot land after the reset.
      await saver.clear();
      await resetLayout(!!data?.mock);
      pins.current.clear();
      setPositions([]);
      apiRef.current?.unpinAll();
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }

  // ----- Selection, search, keyboard -----
  const pathFor = useCallback(
    (id: GraphNodeId) => constellationPath(id, nodes, data?.edges ?? []),
    [nodes, data],
  );
  const constellation = useMemo(
    () => (cosmosData && selectedId ? pathFor(selectedId) : null),
    [cosmosData, selectedId, pathFor],
  );

  const select = useCallback(
    (id: GraphNodeId | null, opts: { center?: boolean; zoom?: number } = {}) => {
      setSelectedId(id);
      if (!id) return;
      const node = byId.get(id);
      if (node) {
        let text = `${typeLabel(node)} ${node.title}, 연결 ${node.size}개. 미리보기 열림`;
        const info = cosmosData?.cosmos[id];
        if (info) {
          const steps = pathFor(id).stepsToLife;
          text += `. 중요도 ${info.score.toFixed(2)}`;
          text += steps === null ? "." : `, 인생 목표까지 ${steps}단계.`;
        }
        setAnnounce(text);
      }
      if (cosmosData) {
        // 6.2: done after render, against the free area with the preview open.
        pendingCamera.current = { id, zoom: opts.center ? opts.zoom : undefined };
        return;
      }
      const api = apiRef.current;
      if (!api) return;
      if (opts.center) api.focusNode(id, { zoom: opts.zoom, offsetX: PANEL_OFFSET, duration: 400 });
      else if (api.isHidden(id, 336)) api.focusNode(id, { offsetX: PANEL_OFFSET, duration: 300 });
    },
    [byId, cosmosData, pathFor],
  );

  const insets = freeArea(canvasSize.width, !!cosmosData && !panelCollapsed, !!selected);
  useEffect(() => {
    const move = pendingCamera.current;
    const api = apiRef.current;
    if (!move || !api || move.id !== selectedId) return;
    pendingCamera.current = null;
    if (move.zoom) {
      // Search pick: centre the node in the free area and zoom in (6.3 of graph.md).
      api.focusNode(move.id, {
        zoom: move.zoom,
        offsetX: (insets.right - insets.left) / 2,
        duration: 400,
      });
    } else if (constellation) {
      api.fitNodes?.(constellation.order, 300);
    }
  }, [selectedId, constellation, insets.left, insets.right]);

  /** Keyboard start: in the cosmos view the brightest sun, else the top-scored node. */
  const startFocus = useCallback((): GraphNodeId | null => {
    if (cosmosData) {
      if (selectedId && byId.has(selectedId)) return selectedId;
      const score = (id: GraphNodeId) => cosmosData.cosmos[id]?.score ?? 0;
      const suns = nodes.filter((n) => cosmosData.cosmos[n.id]?.sun);
      const pool = suns.length ? suns : nodes;
      return (
        pool.reduce<GraphNode | null>(
          (best, n) => (!best || score(n.id) > score(best.id) ? n : best),
          null,
        )?.id ?? null
      );
    }
    return initialFocus(nodes, selectedId);
  }, [cosmosData, nodes, selectedId, byId]);

  async function toggleStar(id: GraphNodeId) {
    const current = cosmosData?.cosmos[id];
    if (!cosmosData || !current || starBusy) return;
    const startLoad = load.status === "ready" ? load.data : null;
    const starred = !current.starred;
    setStarBusy(true);
    try {
      await setStar(id, starred);
      // Re-score locally (same nodes/edges, so the layout stays put) — but only if the
      // data has not been replaced while the request was in flight.
      const next = withStar(cosmosData, id, starred, new Date());
      if (loadRef.current.status === "ready" && loadRef.current.data === startLoad && next) {
        setLoad((prev) =>
          prev.status === "ready" && prev.data === startLoad
            ? { status: "ready", data: { ...next, mock: false } }
            : prev,
        );
      } else {
        // A newer load arrived meanwhile; fetch again so it includes this star.
        setReloadKey((k) => k + 1);
      }
      setAnnounce(starred ? "중요 표시함" : "중요 표시 해제함");
    } catch {
      setAnnounce("중요 표시를 바꾸지 못했습니다");
    } finally {
      setStarBusy(false);
    }
  }

  useEffect(() => {
    const open = () => setSearchOpen(true);
    window.addEventListener(GRAPH_SEARCH_EVENT, open);
    return () => window.removeEventListener(GRAPH_SEARCH_EVENT, open);
  }, []);

  const moveFocus = (id: GraphNodeId | null) => {
    if (!id) return;
    setFocusId(id);
    const node = byId.get(id);
    if (node) setAnnounce(`${typeLabel(node)} ${node.title}, 연결 ${node.size}개`);
    apiRef.current?.revealNode(id, 64, 200);
  };

  const cycleCenter = useRef<GraphNodeId | null>(null);

  function openNode(id: GraphNodeId) {
    const node = byId.get(id);
    const href = node ? nodeHref(node) : null;
    if (href && confirmLeave()) router.push(href);
  }

  function onCanvasKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const api = apiRef.current;
    const current = focusId ?? startFocus();
    const arrows: Record<string, Direction> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    const dir = arrows[e.key];
    if (dir) {
      e.preventDefault();
      if (!focusId) return moveFocus(current);
      const from = api?.nodes().find((n) => n.id === focusId);
      if (!from || !api) return;
      moveFocus(
        nodeInDirection(
          { id: from.id as GraphNodeId, x: from.x, y: from.y },
          dir,
          api.nodes().map((n) => ({ id: n.id as GraphNodeId, x: n.x, y: n.y })),
          neighbors.get(focusId),
        ),
      );
      return;
    }
    if (e.key === "[" || e.key === "]") {
      e.preventDefault();
      if (!current) return;
      const center = cycleCenter.current;
      if (!center || (center !== current && !neighbors.get(center)?.has(current))) {
        cycleCenter.current = current;
      }
      const c = cycleCenter.current!;
      moveFocus(
        cycleNeighbor(
          c,
          current === c ? null : current,
          e.key === "]" ? 1 : -1,
          neighbors.get(c),
          (id) => byId.get(id)?.title ?? "",
        ),
      );
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (current) openNode(current);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (current) {
        setFocusId(current);
        select(current);
      }
      return;
    }
    if (e.key === "Escape") {
      if (selectedId) {
        e.preventDefault();
        setSelectedId(null);
        setAnnounce("미리보기 닫힘");
      } else if (focusId) {
        e.preventDefault();
        setFocusId(null);
      }
      return;
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      api?.zoomBy(1.25);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      api?.zoomBy(0.8);
    } else if (e.key === "0") {
      e.preventDefault();
      api?.zoomToFit();
    }
  }

  const onReady = useCallback((api: GraphCanvasApi) => {
    apiRef.current = api;
  }, []);
  const onTransform = useCallback((t?: { k: number; x: number; y: number }) => {
    if (t) panRef.current = { x: t.x, y: t.y };
    setTransformTick((n) => n + 1);
  }, []);

  // ----- Pieces -----
  const counts = data ? `노드 ${data.nodes.length} · 선 ${data.edges.length}` : "";
  const filterCount = activeFilterCount(filter);
  const showLarge = large && !largeDismissed;

  const segmented = (
    <div
      role="radiogroup"
      aria-label="배치"
      className="inline-flex h-8 shrink-0 rounded-lg border border-border bg-surface p-0.5"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          const next = view === "free" ? "para" : "free";
          changeView(next);
          (e.currentTarget.querySelector(`[data-view="${next}"]`) as HTMLElement | null)?.focus();
        }
      }}
    >
      {(
        [
          ["free", "자유 배치"],
          ["para", "PARA 배치"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          data-view={value}
          aria-checked={view === value}
          tabIndex={view === value ? 0 : -1}
          onClick={() => changeView(value)}
          className={cn(
            "h-7 rounded-md px-3 text-[13px] transition-colors",
            view === value ? "bg-bg font-medium text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const modeToggle = (
    <div
      role="radiogroup"
      aria-label="보기"
      className="inline-flex h-8 shrink-0 rounded-lg border border-border bg-surface p-0.5"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          const next = cosmosMode ? "basic" : "cosmos";
          changeMode(next);
          (e.currentTarget.querySelector(`[data-mode="${next}"]`) as HTMLElement | null)?.focus();
        }
      }}
    >
      {(
        [
          ["basic", "기본"],
          ["cosmos", "우주"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          data-mode={value}
          aria-checked={graphMode === value}
          tabIndex={graphMode === value ? 0 : -1}
          onClick={() => changeMode(value)}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md px-3 text-[13px] transition-colors",
            graphMode === value
              ? "bg-bg font-medium text-fg shadow-sm"
              : "text-muted hover:text-fg",
          )}
        >
          {value === "cosmos" ? (
            <span aria-hidden className="text-[12px] leading-none">
              ✦
            </span>
          ) : null}
          {label}
        </button>
      ))}
    </div>
  );

  let overlay: React.ReactNode = null;
  if (load.status === "error") {
    overlay = (
      <EmptyState
        className="max-w-[360px] bg-bg"
        title="그래프를 불러오지 못했습니다"
        action={
          <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            다시 시도
          </Button>
        }
      />
    );
  } else if (load.status === "loading") {
    overlay = showSpinner ? (
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <Spinner label="그래프를 그리는 중" />
        그래프를 그리는 중…
      </div>
    ) : null;
  } else if (nodes.length === 0) {
    overlay = filter.orphans ? (
      <EmptyState
        className="max-w-[360px] bg-bg"
        title="연결 없는 항목이 없습니다"
        description="모든 항목이 어딘가에 이어져 있습니다."
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter({ ...filter, orphans: undefined })}
          >
            모든 항목 보기
          </Button>
        }
      />
    ) : isDefaultFilter(filter) ? (
      <EmptyState
        className="max-w-[360px] bg-bg"
        title="아직 그래프에 보일 항목이 없습니다"
        description="목표·프로젝트·논문·생각을 만들고 서로 연결하면 여기에 지도처럼 그려집니다."
        action={
          <Link href="/goals" className={buttonClass("secondary", "sm")}>
            목표 세우기
          </Link>
        }
      />
    ) : (
      <EmptyState
        className="max-w-[360px] bg-bg"
        title="조건에 맞는 항목이 없습니다"
        description="종류나 영역 필터를 바꿔 보세요."
        action={
          <Button variant="ghost" size="sm" onClick={() => setFilter({})}>
            필터 초기화
          </Button>
        }
      />
    );
  }

  const columnCounts = useMemo(() => {
    const out = new Map<string, number>();
    for (const c of columns) out.set(c.key, nodes.filter((n) => c.types.includes(n.type)).length);
    return out;
  }, [columns, nodes]);

  const neighborNodes = useMemo(
    () =>
      selected
        ? [...(neighbors.get(selected.id) ?? [])]
            .map((id) => byId.get(id))
            .filter((n): n is GraphNode => !!n)
            .sort((a, b) => b.size - a.size)
        : [],
    [selected, neighbors, byId],
  );

  const helpId = "graph-keyboard-help";

  return (
    <div ref={rootRef} className="flex h-dvh min-h-0 flex-col bg-bg">
      {/* Top bar */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-5">
        <h1 className="text-base font-semibold tracking-tight">그래프</h1>
        <span className="ml-3 text-xs text-muted tabular-nums">{counts}</span>
        {saveError ? (
          <span className="ml-2 text-xs text-danger">위치를 저장하지 못했습니다</span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {narrow ? (
            <Button
              size="sm"
              aria-expanded={filtersOpen}
              aria-controls="graph-filter-panel"
              onClick={() => setFiltersOpen((o) => !o)}
            >
              필터{filterCount ? ` ${filterCount}` : ""}
            </Button>
          ) : null}
          {modeToggle}
          {cosmosMode ? null : segmented}
          {!cosmosMode && view === "free" ? (
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(true)}>
              배치 초기화
            </Button>
          ) : null}
          <Link href="/goals?view=map" className={buttonClass("ghost", "sm")}>
            목표 지도로 보기
          </Link>
        </div>
      </div>

      {/* Filters */}
      {narrow ? (
        filtersOpen ? (
          <div id="graph-filter-panel" className="shrink-0 border-b border-border p-4">
            <GraphFilterControls
              filter={filter}
              onChange={setFilter}
              options={options}
              theme={theme}
              stacked
            />
          </div>
        ) : null
      ) : (
        <div className="flex min-h-11 shrink-0 items-center overflow-x-auto border-b border-border bg-bg px-5 py-1.5">
          <GraphFilterControls
            filter={filter}
            onChange={setFilter}
            options={options}
            theme={theme}
          />
        </div>
      )}

      {showLarge ? (
        <div className="flex h-8 shrink-0 items-center gap-2 bg-surface px-5 text-[13px] text-muted">
          항목이 많습니다. 영역이나 종류로 좁히면 더 잘 보여요.
          <button
            type="button"
            className="ml-auto text-muted hover:text-fg"
            aria-label="안내 닫기"
            onClick={() => {
              sessionStorage.setItem(LARGE_NOTICE_KEY, "1");
              setLargeDismissed(true);
            }}
          >
            ×
          </button>
        </div>
      ) : null}

      {/* Canvas (the cosmos view is always dark: `.dark` gives overlays dark tokens) */}
      <div
        className={cn("relative min-h-0 flex-1", cosmosMode && "dark")}
        style={cosmosMode ? { background: COSMOS_THEME.space } : undefined}
      >
        <div
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label={`그래프. 노드 ${nodes.length}개. 화살표로 이동, Enter로 미리보기.`}
          aria-describedby={helpId}
          onKeyDown={onCanvasKeyDown}
          onFocus={(e) => {
            if (e.target === e.currentTarget && !focusId) moveFocus(startFocus());
          }}
          className="absolute inset-0 overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          {cosmosMode && canvasSize.width > 0 ? (
            <StarField
              width={canvasSize.width}
              height={canvasSize.height}
              reducedMotion={reducedMotion}
              pan={panRef}
            />
          ) : null}
          {cosmosData && nodes.length > 0 && canvasSize.width > 0 ? (
            <div className="relative">
              <CosmosCanvasLazy
                data={cosmosData}
                reducedMotion={reducedMotion}
                width={canvasSize.width}
                height={canvasSize.height}
                selectedId={selectedId}
                focusId={focusId}
                externalHoverId={selectedId ? null : externalHover}
                insets={insets}
                constellation={constellation}
                fitKey={`cosmos:${graphQuery(filter)}`}
                onNodeClick={(node) => {
                  setFocusId(node.id);
                  select(node.id);
                }}
                onBackgroundClick={() => setSelectedId(null)}
                onReady={onReady}
                onTransform={onTransform}
              />
            </div>
          ) : null}
          {!cosmosMode && data && nodes.length > 0 && canvasSize.width > 0 ? (
            <GraphCanvasLazy
              data={data}
              theme={theme}
              reducedMotion={reducedMotion}
              width={canvasSize.width}
              height={canvasSize.height}
              mode={view}
              columns={columns}
              positions={positions}
              selectedId={selectedId}
              focusId={focusId}
              fitKey={graphQuery(filter)}
              focusOnSettle={initial.focus}
              onNodeClick={(node) => {
                setFocusId(node.id);
                select(node.id);
              }}
              onBackgroundClick={() => setSelectedId(null)}
              onPin={onPin}
              onReady={onReady}
              onTransform={onTransform}
            />
          ) : null}
        </div>
        <p id={helpId} className="sr-only">
          화살표: 가까운 노드로 이동. 대괄호: 이웃 순회. Enter: 미리보기. Ctrl 또는 Command와 Enter:
          열기. Esc: 닫기. 슬래시: 노드 검색. 더하기, 빼기, 0: 확대, 축소, 화면에 맞춤.
        </p>
        <div aria-live="polite" className="sr-only">
          {announce}
        </div>

        {!cosmosMode && view === "para" && data && nodes.length > 0 && apiRef.current ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-8 overflow-hidden border-b border-border bg-bg/90">
            {columns.map((c) => {
              const x = apiRef.current!.toScreen(c.x, 0).x;
              return (
                <span
                  key={c.key}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium whitespace-nowrap text-muted"
                  style={{ left: x }}
                >
                  {c.label} <span className="tabular-nums">{columnCounts.get(c.key) ?? 0}</span>
                </span>
              );
            })}
          </div>
        ) : null}

        {overlay ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 [&>*]:pointer-events-auto">
            {overlay}
          </div>
        ) : null}

        {nodes.length > 0 ? (
          <>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg"
            >
              노드 검색 <Kbd>/</Kbd>
            </button>
            <div
              className="absolute bottom-4 flex flex-col overflow-hidden rounded-lg border border-border bg-bg shadow-sm"
              style={{ right: selected ? 352 : 16 }}
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label="확대"
                onClick={() => apiRef.current?.zoomBy(1.25)}
              >
                +
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="축소"
                className="rounded-none border-t border-border"
                onClick={() => apiRef.current?.zoomBy(0.8)}
              >
                −
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="화면에 맞춤"
                className="rounded-none border-t border-border"
                onClick={() => apiRef.current?.zoomToFit()}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  aria-hidden
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                >
                  <path d="M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9" />
                </svg>
              </Button>
            </div>
          </>
        ) : null}

        {cosmosData && nodes.length > 0 ? (
          <CosmosPanel
            data={cosmosData}
            byId={byId}
            collapsed={panelCollapsed}
            onToggle={togglePanel}
            onSelect={(id) => {
              setExternalHover(null);
              setFocusId(id);
              select(id);
            }}
            onHover={setExternalHover}
            onShowAllLonely={() => {
              setFilter({ ...filter, orphans: true });
              changeMode("basic");
            }}
          />
        ) : null}

        {selected ? (
          <GraphPreview
            node={selected}
            neighbors={neighborNodes}
            theme={theme}
            mock={!!data?.mock}
            onClose={() => setSelectedId(null)}
            onSelect={(id) => {
              setFocusId(id);
              select(id);
            }}
            cosmos={
              cosmosData?.cosmos[selected.id] && constellation
                ? (() => {
                    const info = cosmosData.cosmos[selected.id]!;
                    const rank =
                      1 +
                      nodes.filter((n) => (cosmosData.cosmos[n.id]?.score ?? 0) > info.score)
                        .length;
                    return {
                      ...info,
                      rank,
                      chain: constellation.chain
                        .map((id) => byId.get(id))
                        .filter((n): n is GraphNode => !!n),
                      reachesLife: constellation.stepsToLife !== null,
                      canStar: selected.type !== "tag",
                      onToggleStar: () => void toggleStar(selected.id),
                      starBusy,
                    };
                  })()
                : undefined
            }
          />
        ) : null}

        {searchOpen ? (
          <GraphSearch
            nodes={nodes}
            theme={theme}
            onClose={() => setSearchOpen(false)}
            onPick={(node) => {
              setSearchOpen(false);
              setFocusId(node.id);
              select(node.id, { center: true, zoom: 2 });
            }}
          />
        ) : null}
      </div>

      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="끌어 놓은 위치를 모두 지울까요?"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(false)}>
              취소
            </Button>
            <Button variant="danger" size="sm" onClick={confirmReset}>
              배치 초기화
            </Button>
          </>
        }
      />
    </div>
  );
}
