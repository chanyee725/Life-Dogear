"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/components/ui/cn";
import type { RoadmapData } from "@/lib/repo/roadmap-types";
import { DEFAULT_SIZE, defaultCollapsed, edgePath, layoutTree } from "./layout";
import { RoadmapNodeBox } from "./RoadmapNode";

/** Room around the tree so the toggle buttons on the right edge are not clipped. */
const PAD = 24;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2;
/** Pointer travel (px) before a press becomes a drag instead of a click. */
const DRAG_SLOP = 4;

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

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
                <RoadmapNodeBox
                  key={p.key}
                  node={p.node}
                  width={DEFAULT_SIZE.nodeWidth}
                  height={DEFAULT_SIZE.nodeHeight}
                  collapsed={p.collapsed}
                  onToggle={() => toggle(p.id)}
                  style={{ left: p.x, top: p.y }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
