"use client";

/**
 * Local graph card for detail pages (docs/design/graph.md 8): the item and its neighbours
 * (1 or 2 steps), collapsible (remembered in localStorage `rb-local-graph` for every
 * detail page). Clicking a node opens that item. Drag is not saved; wheel zoom needs Ctrl/⌘.
 *
 * Usage: `<LocalGraph node="paper:<id>" />` next to the "연결된 항목" section.
 */
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { confirmLeave } from "@/components/fields/unsaved-guard";
import { cn, LinkButton } from "@/components/ui";
import type { GraphNodeId, LocalGraphData } from "@/lib/graph/types";
import { fetchLocalGraph } from "./api";
import type { GraphCanvasApi } from "./GraphCanvas";
import { GraphCanvasLazy } from "./GraphCanvasLazy";
import { useGraphTheme, useReducedMotion } from "./graph-theme";
import {
  buildNeighbors,
  type Direction,
  distancesFrom,
  GRAPH_TYPE_LABEL,
  nodeHref,
  nodeInDirection,
} from "./model";
import { useElementSize } from "./use-element-size";

export const LOCAL_GRAPH_STORAGE_KEY = "rb-local-graph";

export function LocalGraph({ node, className }: { node: GraphNodeId; className?: string }) {
  const router = useRouter();
  const theme = useGraphTheme();
  const reducedMotion = useReducedMotion();
  const bodyId = useId();
  const [collapsed, setCollapsed] = useState(false);
  const [depth, setDepth] = useState<1 | 2>(1);
  const [data, setData] = useState<LocalGraphData | null>(null);
  const [failed, setFailed] = useState(false);
  const [focusId, setFocusId] = useState<GraphNodeId | null>(null);
  const [announce, setAnnounce] = useState("");
  const apiRef = useRef<GraphCanvasApi | null>(null);
  const [canvasRef, size] = useElementSize<HTMLDivElement>();

  useEffect(() => {
    setCollapsed(localStorage.getItem(LOCAL_GRAPH_STORAGE_KEY) === "collapsed");
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    if (next) localStorage.setItem(LOCAL_GRAPH_STORAGE_KEY, "collapsed");
    else localStorage.removeItem(LOCAL_GRAPH_STORAGE_KEY);
  }

  useEffect(() => {
    if (collapsed) return;
    const controller = new AbortController();
    setFailed(false);
    fetchLocalGraph(node, depth, controller.signal)
      .then((d) => setData(d ?? { nodes: [], edges: [], truncated: false }))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [node, depth, collapsed]);

  const distances = useMemo(
    () => (data ? distancesFrom(data.edges, node, depth) : undefined),
    [data, node, depth],
  );
  const neighbors = useMemo(() => buildNeighbors(data?.edges ?? []), [data]);
  const neighborCount = data ? Math.max(data.nodes.length - 1, 0) : null;
  const empty = !!data && data.nodes.length <= 1;

  const open = useCallback(
    (id: GraphNodeId) => {
      if (id === node) return;
      const target = data?.nodes.find((n) => n.id === id);
      const href = target ? nodeHref(target) : null;
      if (href && confirmLeave()) router.push(href);
    },
    [data, node, router],
  );

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || !data) return;
    const dirs: Record<string, Direction> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    const dir = dirs[e.key];
    const api = apiRef.current;
    if (dir && api) {
      e.preventDefault();
      const from = api.nodes().find((n) => n.id === (focusId ?? node));
      if (!from) return;
      const next = nodeInDirection(
        { id: from.id as GraphNodeId, x: from.x, y: from.y },
        dir,
        api.nodes().map((n) => ({ id: n.id as GraphNodeId, x: n.x, y: n.y })),
        neighbors.get(from.id as GraphNodeId),
      );
      if (next) {
        setFocusId(next);
        const n = data.nodes.find((x) => x.id === next);
        if (n) setAnnounce(`${GRAPH_TYPE_LABEL[n.type]} ${n.title}, 연결 ${n.size}개`);
      }
    } else if ((e.key === "Enter" || e.key === " ") && focusId) {
      e.preventDefault();
      open(focusId);
    } else if (e.key === "Escape" && focusId) {
      e.preventDefault();
      setFocusId(null);
    }
  }

  return (
    <section className={cn("rounded-lg border border-border bg-bg", className)}>
      <div
        className={cn("flex h-10 items-center gap-2 px-3", !collapsed && "border-b border-border")}
      >
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={toggle}
          className="flex min-w-0 items-center gap-1.5 rounded-md text-left"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("shrink-0 text-muted transition-transform", collapsed && "-rotate-90")}
          >
            <path d="M3 4.5 6 7.5l3-3" />
          </svg>
          <span className="text-sm font-medium text-fg">로컬 그래프</span>
          {neighborCount !== null ? (
            <span className="text-xs text-muted tabular-nums">{neighborCount}</span>
          ) : null}
        </button>
        {!collapsed ? (
          <div className="ml-auto flex items-center gap-1.5">
            <div
              role="radiogroup"
              aria-label="깊이"
              className="inline-flex h-7 rounded-lg border border-border bg-surface p-0.5"
            >
              {([1, 2] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={depth === d}
                  tabIndex={depth === d ? 0 : -1}
                  onClick={() => setDepth(d)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                      e.preventDefault();
                      setDepth(depth === 1 ? 2 : 1);
                    }
                  }}
                  className={cn(
                    "h-6 rounded-md px-2 text-xs transition-colors",
                    depth === d
                      ? "bg-bg font-medium text-fg shadow-sm"
                      : "text-muted hover:text-fg",
                  )}
                >
                  {d}단계
                </button>
              ))}
            </div>
            <LinkButton href={`/graph?focus=${encodeURIComponent(node)}`} variant="ghost" size="sm">
              전체 그래프
            </LinkButton>
          </div>
        ) : null}
      </div>
      {!collapsed ? (
        <div id={bodyId}>
          {failed ? (
            <p className="flex h-24 items-center justify-center text-[13px] text-muted">
              로컬 그래프를 불러오지 못했습니다.
            </p>
          ) : empty ? null : (
            <>
              <div
                ref={canvasRef}
                tabIndex={0}
                role="application"
                aria-label={`로컬 그래프. 노드 ${data?.nodes.length ?? 0}개. 화살표로 이동, Enter로 열기.`}
                onKeyDown={onKeyDown}
                className="relative h-[220px] overflow-hidden rounded-b-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent lg:h-[260px]"
              >
                {data && size.width > 0 ? (
                  <GraphCanvasLazy
                    data={data}
                    theme={theme}
                    reducedMotion={reducedMotion}
                    width={size.width}
                    height={size.height}
                    variant="local"
                    centerId={node}
                    focusId={focusId}
                    distances={distances}
                    fitKey={`${node}:${depth}`}
                    onNodeClick={(n) => open(n.id)}
                    onReady={(api) => {
                      apiRef.current = api;
                    }}
                  />
                ) : null}
              </div>
              {data?.truncated ? (
                <p className="border-t border-border px-3 py-1.5 text-xs text-muted">
                  이웃이 많아 일부만 표시합니다.
                </p>
              ) : null}
              <div aria-live="polite" className="sr-only">
                {announce}
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
