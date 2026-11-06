"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
import { defaultCollapsed, edgePath, inLineage, layoutTree, rootAnchor } from "./roadmapLayout";
import { KIND_LABEL, RoadmapNodeBox, TaskCheck } from "./RoadmapNode";
import RoadmapToolbar, { SEG_BTN, SEG_GROUP } from "./RoadmapToolbar";
import { countAll } from "./roadmapStats";
import { MAX_ZOOM, MIN_ZOOM, useViewport, type Rect } from "./useViewport";
import { AreaIcon, GoalIcon, ProjectIcon } from "@/components/shell/icons";

/** Room around the tree (layout px) so boxes do not touch the scroll edge. */
const PAD = 28;
const ZOOM_STEP = 0.1;
/** The drawn root ('나의 로드맵') and the gap to the area column. */
const ROOT = { width: 116, height: 40, gap: 72 };
/** Dashed tail drawn off an area with nothing under it. */
const TAIL = 40;
const TAIL_ROOM = TAIL + 72;
/** Branch colours cycle through this many tones (see .rb-roadmap-canvas in globals.css). */
const BRANCH_TONES = 6;
/** Stroke weight by the child end's depth: thick at the root, thinner toward the tips. */
const STROKE = [4.5, 3, 2.25, 1.5];
const stroke = (depth: number) => STROKE[Math.min(depth, STROKE.length - 1)];

/** Edge path written as a CSS `d`, so a collapse animates the curve with its boxes. */
const pathStyle = (d: string) => ({ d: `path("${d}")` }) as CSSProperties;

function Legend() {
  const items: { kind: keyof typeof KIND_LABEL; icon: ReactNode }[] = [
    { kind: "area", icon: <AreaIcon /> },
    { kind: "goal", icon: <GoalIcon /> },
    { kind: "project", icon: <ProjectIcon /> },
    { kind: "task", icon: <TaskCheck done={false} /> },
  ];
  return (
    <ul className="rb-roadmap-legend" aria-label="범례">
      {items.map((i) => (
        <li key={i.kind} data-kind={i.kind}>
          <span aria-hidden="true">{i.icon}</span>
          {KIND_LABEL[i.kind]}
        </li>
      ))}
    </ul>
  );
}

export default function RoadmapTree({ data }: { data: RoadmapData }) {
  const [collapsed, setCollapsed] = useState<CollapsedSet>(() => defaultCollapsed(data.roots));
  const layout = useMemo(() => layoutTree(data.roots, collapsed), [data.roots, collapsed]);
  const counts = useMemo(() => countAll(data.roots), [data.roots]);
  /** Path key of the hovered / focused node: its lineage stays lit, the rest dims. */
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const rootY = rootAnchor(layout) - ROOT.height / 2;
  const ox = ROOT.width + ROOT.gap; // tree's left edge, right of the drawn root
  // Only the first layout matters: the hook focuses once.
  const [initialFocus] = useState<Rect | null>(() =>
    layout.nodes.length ? { x: PAD, y: PAD + rootY, ...ROOT } : null,
  );
  const { ref, zoom, dragging, setZoom } = useViewport({ initialFocus });

  const zoomControls = data.roots.length > 0 && (
    <div className={`${SEG_GROUP} ml-auto`} role="group" aria-label="확대/축소">
      <button
        type="button"
        aria-label="축소"
        className={SEG_BTN}
        disabled={zoom <= MIN_ZOOM}
        onClick={() => setZoom(zoom - ZOOM_STEP)}
      >
        −
      </button>
      <button
        type="button"
        aria-label="원래 크기"
        title="원래 크기"
        className={cn(SEG_BTN, "min-w-14 justify-center tabular-nums")}
        onClick={() => setZoom(1)}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label="확대"
        className={SEG_BTN}
        disabled={zoom >= MAX_ZOOM}
        onClick={() => setZoom(zoom + ZOOM_STEP)}
      >
        +
      </button>
    </div>
  );

  const toolbar = (
    <RoadmapToolbar
      includeDone={data.includeDone}
      onExpandAll={() => setCollapsed(expandAll())}
      onCollapseAll={() => setCollapsed(collapseAll(data.roots))}
      allExpanded={isAllExpanded(data.roots, collapsed)}
      allCollapsed={isAllCollapsed(data.roots, collapsed)}
    >
      {zoomControls}
    </RoadmapToolbar>
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

  const tone = (branch: number) =>
    data.roots[branch]?.id === "none" ? "none" : String(branch % BRANCH_TONES);
  const dim = (key: string) => (focusKey !== null && !inLineage(key, focusKey) ? "true" : undefined);
  const bareAreas = layout.nodes.filter((p) => p.depth === 0 && p.node.children.length === 0);
  const areaRight = layout.nodes.find((p) => p.depth === 0)!.width;
  const treeW = Math.max(layout.width, bareAreas.length ? areaRight + TAIL_ROOM : 0);
  const w = ox + treeW + PAD * 2;
  const h = Math.max(layout.height, ROOT.height) + PAD * 2;
  const rx = ROOT.width; // root's right edge (tree coords, before ox)
  const ry = rootY + ROOT.height / 2;

  return (
    <div className="flex flex-col gap-3">
      {toolbar}
      <div
        ref={ref}
        data-testid="roadmap-viewport"
        className={cn(
          "rb-roadmap-canvas max-h-[75vh] min-h-48 w-fit max-w-full self-start overflow-auto",
          dragging ? "cursor-grabbing select-none" : "cursor-grab",
        )}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusKey(null);
        }}
      >
        <div style={{ width: w * zoom, height: h * zoom }}>
          <div
            className="rb-roadmap-plane relative"
            style={{ width: w, height: h, transform: `scale(${zoom})`, transformOrigin: "0 0" }}
          >
            <svg
              className="pointer-events-none absolute inset-0 overflow-visible"
              width={w}
              height={h}
              aria-hidden="true"
            >
              <g transform={`translate(${PAD},${PAD})`}>
                {layout.nodes
                  .filter((p) => p.depth === 0)
                  .map((p) => {
                    const d = edgePath({ x1: rx, y1: ry, x2: ox, y2: p.y + p.height / 2 });
                    return (
                      <path
                        key={`root/${p.key}`}
                        className="rb-roadmap-edge"
                        data-tone={tone(p.branch)}
                        data-dim={dim(p.key)}
                        d={d}
                        style={pathStyle(d)}
                        strokeWidth={stroke(0)}
                      />
                    );
                  })}
                <g transform={`translate(${ox},0)`}>
                  {layout.edges.map((e) => {
                    const d = edgePath(e);
                    return (
                      <path
                        key={e.key}
                        className="rb-roadmap-edge"
                        data-tone={tone(e.branch)}
                        data-dim={dim(e.key)}
                        d={d}
                        style={pathStyle(d)}
                        strokeWidth={stroke(e.depth)}
                      />
                    );
                  })}
                  {bareAreas.map((p) => {
                    const y = p.y + p.height / 2;
                    const d = `M${p.x + p.width},${y} H${p.x + p.width + TAIL}`;
                    return (
                      <path
                        key={`tail/${p.key}`}
                        className="rb-roadmap-edge rb-roadmap-tail"
                        data-tone={tone(p.branch)}
                        data-dim={dim(p.key)}
                        d={d}
                        style={pathStyle(d)}
                        strokeWidth={stroke(1)}
                      />
                    );
                  })}
                </g>
              </g>
            </svg>
            <div className="absolute" style={{ left: PAD, top: PAD }}>
              <div
                className="rb-roadmap-root"
                data-testid="roadmap-root"
                style={{ width: ROOT.width, height: ROOT.height, transform: `translate(0px, ${rootY}px)` }}
              >
                나의 로드맵
              </div>
              {bareAreas.map((p) => (
                <span
                  key={`hint/${p.key}`}
                  className="rb-roadmap-hint"
                  data-dim={dim(p.key)}
                  style={{
                    transform: `translate(${ox + p.x + p.width + TAIL + 8}px, ${p.y + p.height / 2}px)`,
                  }}
                >
                  목표 없음
                </span>
              ))}
              {layout.nodes.map((p) => (
                <RoadmapNodeBox
                  key={p.key}
                  node={p.node}
                  width={p.width}
                  height={p.height}
                  collapsed={p.collapsed}
                  counts={p.depth === 0 ? counts.get(p.id) : undefined}
                  onToggle={() => setCollapsed((c) => toggleCollapsed(c, p.id))}
                  style={
                    {
                      transform: `translate(${ox + p.x}px, ${p.y}px)`,
                      "--rb-roadmap-depth": p.depth,
                    } as CSSProperties
                  }
                  tone={tone(p.branch)}
                  dim={dim(p.key) === "true"}
                  onFocusIn={() => setFocusKey(p.key)}
                  onFocusOut={() => setFocusKey(null)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Legend />
        <span className="ml-auto hidden text-xs text-faint md:inline">
          드래그로 이동, Ctrl+휠로 확대·축소
        </span>
      </div>
    </div>
  );
}
