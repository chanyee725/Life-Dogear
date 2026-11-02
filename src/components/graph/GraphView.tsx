"use client";

/**
 * `/graph` screen (docs/design/graph.md 6–7, 9–11): top bar, filter bar, force canvas with
 * PARA columns, node search, preview panel, keyboard navigation. Client only.
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
import type { GraphFilter, GraphNode, GraphNodeId, GraphPosition } from "@/lib/graph/types";
import { fetchGraph, type GraphLoad, resetLayout, saveLayout } from "./api";
import type { GraphCanvasApi } from "./GraphCanvas";
import { GraphCanvasLazy } from "./GraphCanvasLazy";
import { type FilterOptions, GraphFilterControls } from "./GraphFilterBar";
import { GraphPreview } from "./GraphPreview";
import { GraphSearch } from "./GraphSearch";
import { useGraphTheme, useReducedMotion } from "./graph-theme";
import {
  activeFilterCount,
  buildNeighbors,
  cycleNeighbor,
  type Direction,
  goalLabel,
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
import { useElementSize } from "./use-element-size";

const PANEL_OFFSET = 168; // (320 + 16) / 2: keeps the selected node clear of the preview.
const NARROW = 900;
const LARGE_NOTICE_KEY = "rb-graph-large-notice";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: GraphLoad };

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
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
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

  useEffect(() => {
    setLargeDismissed(sessionStorage.getItem(LARGE_NOTICE_KEY) === "1");
  }, []);

  // ----- Data -----
  useEffect(() => {
    const controller = new AbortController();
    setLoad((prev) => (prev.status === "ready" ? prev : { status: "loading" }));
    const spinner = setTimeout(() => setShowSpinner(true), 300);
    fetchGraph(filter, controller.signal)
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
  }, [filter, reloadKey]);

  // URL mirrors filter/view/selection (refresh and share keep the view).
  useEffect(() => {
    const params = new URLSearchParams(pageQuery({ filter, view, focus: selectedId }));
    // Keep the performance-check mock (`?mock=<n>`) across filter changes.
    const mock = new URLSearchParams(window.location.search).get("mock");
    if (mock) params.set("mock", mock);
    const q = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${q ? `?${q}` : ""}`,
    );
  }, [filter, view, selectedId]);

  const data = load.status === "ready" ? load.data : null;
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

  // ----- Layout saving (300ms debounce, batched) -----
  const pending = useRef(new Map<GraphNodeId, GraphPosition>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPin = useCallback(
    (p: GraphPosition) => {
      pins.current.set(p.node, p);
      pending.current.set(p.node, p);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const batch = [...pending.current.values()];
        pending.current.clear();
        saveLayout(batch, !!data?.mock).then(
          () => setSaveError(false),
          () => setSaveError(true),
        );
      }, 300);
    },
    [data?.mock],
  );
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  function changeView(next: ViewMode) {
    if (next === view) return;
    // Hand the canvas the latest pins so the free layout restores them.
    setPositions([...pins.current.values()]);
    setView(next);
  }

  async function confirmReset() {
    setResetOpen(false);
    try {
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
  const select = useCallback(
    (id: GraphNodeId | null, opts: { center?: boolean; zoom?: number } = {}) => {
      setSelectedId(id);
      if (!id) return;
      const node = byId.get(id);
      if (node) setAnnounce(`${typeLabel(node)} ${node.title}, 연결 ${node.size}개. 미리보기 열림`);
      const api = apiRef.current;
      if (!api) return;
      if (opts.center) api.focusNode(id, { zoom: opts.zoom, offsetX: PANEL_OFFSET, duration: 400 });
      else if (api.isHidden(id, 336)) api.focusNode(id, { offsetX: PANEL_OFFSET, duration: 300 });
    },
    [byId],
  );

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
    const current = focusId ?? initialFocus(nodes, selectedId);
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
  const onTransform = useCallback(() => setTransformTick((t) => t + 1), []);

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
          {segmented}
          {view === "free" ? (
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(true)}>
              배치 초기화
            </Button>
          ) : null}
          <Link href="/goals" className={buttonClass("ghost", "sm")}>
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

      {/* Canvas */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label={`그래프. 노드 ${nodes.length}개. 화살표로 이동, Enter로 미리보기.`}
          aria-describedby={helpId}
          onKeyDown={onCanvasKeyDown}
          onFocus={(e) => {
            if (e.target === e.currentTarget && !focusId)
              moveFocus(initialFocus(nodes, selectedId));
          }}
          className="absolute inset-0 overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          {data && nodes.length > 0 && canvasSize.width > 0 ? (
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

        {view === "para" && data && nodes.length > 0 && apiRef.current ? (
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
