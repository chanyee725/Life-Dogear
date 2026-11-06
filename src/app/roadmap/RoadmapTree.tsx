"use client";

import { useMemo, useState } from "react";
import { cn } from "@/components/ui/cn";
import type { RoadmapData } from "@/lib/repo/roadmap-types";
import {
  collapseAll,
  expandAll,
  isAllCollapsed,
  isAllExpanded,
  toggleCollapsed,
  type CollapsedSet,
} from "./collapse";
import { DEFAULT_SIZE, defaultCollapsed, edgePath, layoutTree, type TreeLayout } from "./roadmapLayout";
import { RoadmapNodeBox } from "./RoadmapNode";
import RoadmapToolbar from "./RoadmapToolbar";
import { MAX_ZOOM, MIN_ZOOM, useViewport, type Rect } from "./useViewport";

/** Room around the tree (layout px) so boxes do not touch the scroll edge. */
const PAD = 24;
const ZOOM_STEP = 0.1;

const ZOOM_BTN =
  "inline-flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border px-1.5 text-[13px] text-muted tabular-nums transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent";

/** The first root's box in canvas px (layout + padding), to scroll into view on mount. */
function rootRect(layout: TreeLayout): Rect | null {
  const first = layout.nodes[0];
  if (!first) return null;
  return {
    x: first.x + PAD,
    y: first.y + PAD,
    width: DEFAULT_SIZE.nodeWidth,
    height: DEFAULT_SIZE.nodeHeight,
  };
}

/**
 * Left-to-right tree of areas → goals → projects → tasks. Boxes link to their detail page;
 * each parent folds its children. The canvas scrolls both ways, pans by mouse drag and
 * zooms with Ctrl+wheel (or the buttons).
 */
export default function RoadmapTree({ data }: { data: RoadmapData }) {
  const [collapsed, setCollapsed] = useState<CollapsedSet>(() => defaultCollapsed(data.roots));
  const layout = useMemo(() => layoutTree(data.roots, collapsed), [data.roots, collapsed]);
  // Only the first layout matters: the hook focuses once.
  const [initialFocus] = useState(() => rootRect(layout));
  const { ref, zoom, dragging, setZoom } = useViewport({ initialFocus });

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <RoadmapToolbar
        includeDone={data.includeDone}
        onExpandAll={() => setCollapsed(expandAll())}
        onCollapseAll={() => setCollapsed(collapseAll(data.roots))}
        allExpanded={isAllExpanded(data.roots, collapsed)}
        allCollapsed={isAllCollapsed(data.roots, collapsed)}
      />
      {data.roots.length > 0 && (
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 hidden text-xs text-faint md:inline">
            드래그로 이동 · Ctrl+휠로 확대/축소
          </span>
          <button
            type="button"
            aria-label="축소"
            className={ZOOM_BTN}
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom(zoom - ZOOM_STEP)}
          >
            −
          </button>
          <button
            type="button"
            aria-label="원래 크기"
            title="원래 크기"
            className={cn(ZOOM_BTN, "min-w-12")}
            onClick={() => setZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="확대"
            className={ZOOM_BTN}
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom(zoom + ZOOM_STEP)}
          >
            +
          </button>
        </div>
      )}
    </div>
  );

  if (data.roots.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {toolbar}
        <p
          data-testid="roadmap-empty"
          className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted"
        >
          {data.includeDone
            ? "아직 그릴 항목이 없습니다. 영역·목표·프로젝트를 만들면 여기에 나무로 펼쳐집니다."
            : "진행 중인 항목이 없습니다. 영역·목표·프로젝트를 만들거나 완료 항목도 보이게 해 보세요."}
        </p>
      </div>
    );
  }

  const w = layout.width + PAD * 2;
  const h = layout.height + PAD * 2;

  return (
    <div className="flex flex-col gap-3">
      {toolbar}
      <div
        ref={ref}
        data-testid="roadmap-viewport"
        className={cn(
          "max-h-[75vh] min-h-48 overflow-auto rounded-lg border border-border bg-surface",
          dragging ? "cursor-grabbing select-none" : "cursor-grab",
        )}
      >
        <div style={{ width: w * zoom, height: h * zoom }}>
          <div
            className="relative"
            style={{ width: w, height: h, transform: `scale(${zoom})`, transformOrigin: "0 0" }}
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
                  onToggle={() => setCollapsed((c) => toggleCollapsed(c, p.id))}
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
