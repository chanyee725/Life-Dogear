"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AreaIcon, GoalIcon, ProjectIcon } from "@/components/shell/icons";
import { cn } from "@/components/ui/cn";
import type { RoadmapData, RoadmapKind, RoadmapNode } from "@/lib/repo/roadmap-types";
import { DEFAULT_SIZE, defaultCollapsed, edgePath, layoutTree, type PlacedNode } from "./layout";

/** Room around the tree so the toggle buttons on the right edge are not clipped. */
const PAD = 24;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2;
/** Pointer travel (px) before a press becomes a drag instead of a click. */
const DRAG_SLOP = 4;

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

const KIND: Record<RoadmapKind, { label: string; chip: string; bar: string }> = {
  area: { label: "영역", chip: "bg-tone-teal-bg text-tone-teal-fg", bar: "bg-tone-teal-fg" },
  goal: { label: "목표", chip: "bg-tone-rose-bg text-tone-rose-fg", bar: "bg-tone-rose-fg" },
  project: { label: "프로젝트", chip: "bg-tone-blue-bg text-tone-blue-fg", bar: "bg-tone-blue-fg" },
  task: { label: "할 일", chip: "bg-tone-green-bg text-tone-green-fg", bar: "bg-tone-green-fg" },
};

function CheckBox({ done }: { done: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
        fill={done ? "currentColor" : "none"}
      />
      {done && (
        <path
          d="m5.25 8.25 1.9 1.85 3.6-4"
          stroke="var(--rb-bg)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function KindIcon({ node }: { node: RoadmapNode }) {
  switch (node.kind) {
    case "area":
      return <AreaIcon />;
    case "goal":
      return <GoalIcon />;
    case "project":
      return <ProjectIcon />;
    case "task":
      return <CheckBox done={!!node.done} />;
  }
}

/** Second line: progress for goals/projects, otherwise due date or status. */
function Meta({ node }: { node: RoadmapNode }) {
  const extra = [node.due, node.status].filter(Boolean).join(" · ");
  if ((node.kind === "goal" || node.kind === "project") && node.progress !== null) {
    const pct = Math.round(Math.min(1, Math.max(0, node.progress)) * 100);
    return (
      <span className="mt-1 flex items-center gap-2">
        <span
          role="progressbar"
          aria-label="진행률"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-tone-gray-bg"
        >
          <span
            className={cn("block h-full rounded-full", KIND[node.kind].bar)}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="text-xs text-muted tabular-nums">{pct}%</span>
        {node.due && <span className="truncate text-xs text-faint">{node.due}</span>}
      </span>
    );
  }
  const text = node.kind === "area" ? `하위 ${node.children.length}개` : extra;
  if (!text) return null;
  return <span className="mt-0.5 block truncate text-xs text-muted">{text}</span>;
}

function NodeBox({ placed, onToggle }: { placed: PlacedNode; onToggle: (id: string) => void }) {
  const { node, id, collapsed } = placed;
  const kind = KIND[node.kind];
  const hasChildren = node.children.length > 0;
  const body: ReactNode = (
    <>
      <span
        className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", kind.chip)}
      >
        <KindIcon node={node} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="sr-only">{kind.label}: </span>
        <span
          className={cn(
            "block truncate text-sm font-medium text-fg",
            node.done && "text-muted line-through",
          )}
        >
          {node.title}
        </span>
        <Meta node={node} />
      </span>
    </>
  );
  const boxClass =
    "flex h-full items-center gap-2.5 rounded-lg border border-border bg-bg pr-4 pl-2.5 shadow-sm";
  return (
    <div
      className="absolute"
      style={{
        left: placed.x,
        top: placed.y,
        width: DEFAULT_SIZE.nodeWidth,
        height: DEFAULT_SIZE.nodeHeight,
      }}
    >
      {node.href ? (
        <Link
          href={node.href}
          draggable={false}
          title={node.title}
          data-testid={`roadmap-node-${id}`}
          className={cn(
            boxClass,
            "cursor-pointer transition-colors hover:border-border-strong hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          )}
        >
          {body}
        </Link>
      ) : (
        <div title={node.title} data-testid={`roadmap-node-${id}`} className={boxClass}>
          {body}
        </div>
      )}
      {hasChildren && (
        <button
          type="button"
          data-testid={`roadmap-toggle-${id}`}
          aria-expanded={!collapsed}
          aria-label={`${node.title} ${collapsed ? "펼치기" : "접기"}`}
          title={collapsed ? "펼치기" : "접기"}
          onClick={() => onToggle(id)}
          className="absolute top-1/2 -right-2.5 flex h-5 min-w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-bg px-1 text-[11px] leading-none text-muted tabular-nums hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {collapsed ? node.children.length : "−"}
        </button>
      )}
    </div>
  );
}

export default function RoadmapTree({ data }: { data: RoadmapData }) {
  const [collapsed, setCollapsed] = useState(() => defaultCollapsed(data.roots));
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  /** Content point kept under the cursor across a zoom step. */
  const anchor = useRef<{ cx: number; cy: number; px: number; py: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(
    null,
  );
  const swallowClick = useRef(false);

  const layout = useMemo(() => layoutTree(data.roots, collapsed), [data.roots, collapsed]);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const zoomTo = useCallback((next: number, px?: number, py?: number) => {
    const el = viewport.current;
    const z = clampZoom(next);
    if (!el || z === zoomRef.current) return;
    const ax = px ?? el.clientWidth / 2;
    const ay = py ?? el.clientHeight / 2;
    anchor.current = {
      cx: (el.scrollLeft + ax) / zoomRef.current,
      cy: (el.scrollTop + ay) / zoomRef.current,
      px: ax,
      py: ay,
    };
    zoomRef.current = z;
    setZoom(z);
  }, []);

  // Keep the anchored point still after the canvas resizes.
  useLayoutEffect(() => {
    const el = viewport.current;
    const a = anchor.current;
    if (!el || !a) return;
    el.scrollLeft = a.cx * zoom - a.px;
    el.scrollTop = a.cy * zoom - a.py;
    anchor.current = null;
  }, [zoom]);

  // Ctrl/⌘ + wheel zooms; React's onWheel is passive, so attach by hand.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomTo(zoomRef.current * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  // Release a drag anywhere, even outside the viewport.
  useEffect(() => {
    const end = () => {
      if (drag.current?.moved) swallowClick.current = true;
      drag.current = null;
      setDragging(false);
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  // Mouse drag pans; touch keeps native scrolling.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = viewport.current;
    if (!el || e.pointerType !== "mouse" || e.button !== 0) return;
    if ((e.target as Element).closest("button")) return;
    swallowClick.current = false;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      moved: false,
    };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = viewport.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_SLOP) return;
      d.moved = true;
      setDragging(true);
    }
    el.scrollLeft = d.left - dx;
    el.scrollTop = d.top - dy;
  };
  // A press that turned into a drag must not follow the link under it.
  const onClickCapture = (e: React.MouseEvent) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  if (data.roots.length === 0) {
    return (
      <p
        data-testid="roadmap-empty"
        className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted"
      >
        {data.includeDone
          ? "아직 그릴 항목이 없습니다. 영역·목표·프로젝트를 만들면 여기에 나무로 펼쳐집니다."
          : "진행 중인 항목이 없습니다. 영역·목표·프로젝트를 만들거나 완료 항목도 보이게 해 보세요."}
      </p>
    );
  }

  const w = layout.width + PAD * 2;
  const h = layout.height + PAD * 2;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-1 text-xs text-muted">
        <span className="mr-auto hidden sm:inline">드래그로 이동 · Ctrl+휠로 확대/축소</span>
        <button
          type="button"
          aria-label="축소"
          onClick={() => zoomTo(zoom - 0.1)}
          disabled={zoom <= ZOOM_MIN}
          className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border hover:bg-hover disabled:cursor-default disabled:opacity-40"
        >
          −
        </button>
        <button
          type="button"
          aria-label="원래 크기"
          onClick={() => zoomTo(1)}
          className="h-7 min-w-12 cursor-pointer rounded-md border border-border px-1.5 tabular-nums hover:bg-hover"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          aria-label="확대"
          onClick={() => zoomTo(zoom + 0.1)}
          disabled={zoom >= ZOOM_MAX}
          className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border hover:bg-hover disabled:cursor-default disabled:opacity-40"
        >
          +
        </button>
      </div>
      <div
        ref={viewport}
        data-testid="roadmap-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
        className={cn(
          "max-h-[75vh] min-h-48 overflow-auto rounded-lg border border-border bg-surface select-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <div style={{ width: w * zoom, height: h * zoom }}>
          <div
            className="relative origin-top-left"
            style={{ width: w, height: h, transform: `scale(${zoom})` }}
          >
            <svg
              className="pointer-events-none absolute inset-0 overflow-visible"
              width={w}
              height={h}
              aria-hidden="true"
            >
              <g transform={`translate(${PAD},${PAD})`}>
                {layout.edges.map((e) => (
                  <path
                    key={e.key}
                    d={edgePath(e)}
                    fill="none"
                    stroke="var(--rb-border-strong)"
                    strokeWidth={1.5}
                  />
                ))}
              </g>
            </svg>
            <div className="absolute" style={{ left: PAD, top: PAD }}>
              {layout.nodes.map((p) => (
                <NodeBox key={p.key} placed={p} onToggle={toggle} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
