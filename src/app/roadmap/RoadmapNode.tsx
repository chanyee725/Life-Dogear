"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { AreaIcon, GoalIcon, ProjectIcon } from "@/components/shell/icons";
import type { RoadmapKind, RoadmapNode } from "@/lib/repo/roadmap-types";

export interface RoadmapNodeBoxProps {
  node: RoadmapNode;
  /** Box size in layout px (layout.ts DEFAULT_SIZE.nodeWidth / nodeHeight). */
  width: number;
  height: number;
  /** Children hidden. Only matters when the node has children. */
  collapsed?: boolean;
  /** Collapse / expand. Without it no toggle button is shown. */
  onToggle?: () => void;
  /** Absolute placement from the layout, e.g. `{ left: x, top: y }`. */
  style?: CSSProperties;
  className?: string;
}

const KIND_LABEL: Record<RoadmapKind, string> = {
  area: "영역",
  goal: "목표",
  project: "프로젝트",
  task: "할 일",
};

/** Empty box, or a checked box when the task is done. */
function TaskCheck({ done }: { done: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      {done && <path d="m5.25 8.25 1.9 1.85 3.6-4" />}
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
      return <TaskCheck done={!!node.done} />;
  }
}

function ChevronIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4.5 3 3 3-3 3" />
    </svg>
  );
}

/** 0..1 → whole percent, clamped; null when there is nothing to show. */
function toPercent(progress: number | null): number | null {
  if (progress == null || !Number.isFinite(progress)) return null;
  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}

/**
 * One roadmap box. Positioned by the caller (`style`), sized by `width` / `height`.
 * The box body links to `node.href`; the collapse button sits beside the link
 * (not inside it), so toggling never navigates.
 */
export function RoadmapNodeBox({
  node,
  width,
  height,
  collapsed = false,
  onToggle,
  style,
  className,
}: RoadmapNodeBoxProps) {
  const testId = `${node.kind}-${node.id}`;
  const childCount = node.children.length;
  const hasToggle = childCount > 0 && !!onToggle;
  const percent = node.kind === "goal" || node.kind === "project" ? toPercent(node.progress) : null;
  const done = node.kind === "task" && !!node.done;

  const meta: ReactNode[] = [];
  if (percent != null) {
    meta.push(
      <span key="progress" className="rb-roadmap-progress">
        <span
          className="rb-roadmap-progress-track"
          role="progressbar"
          aria-label="진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span className="rb-roadmap-progress-fill" style={{ width: `${percent}%` }} />
        </span>
        <span className="rb-roadmap-progress-label">{percent}%</span>
      </span>,
    );
  }
  if (node.due) {
    meta.push(
      <span key="due" className="rb-roadmap-due">
        {node.due}
      </span>,
    );
  }

  const body = (
    <>
      <span className="rb-roadmap-icon" aria-hidden="true">
        <KindIcon node={node} />
      </span>
      <span className="rb-roadmap-text">
        <span className="rb-roadmap-title">{node.title}</span>
        {meta.length > 0 && <span className="rb-roadmap-meta">{meta}</span>}
      </span>
    </>
  );

  const tooltip = node.status ? `${node.title} · ${node.status}` : node.title;
  const label = `${KIND_LABEL[node.kind]}: ${node.title}${done ? " (완료)" : ""}`;

  const onToggleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle?.();
  };

  return (
    <div
      className={cn(
        "rb-roadmap-node",
        `rb-roadmap-node--${node.kind}`,
        hasToggle && "rb-roadmap-node--has-toggle",
        className,
      )}
      style={{ width, height, ...style }}
      data-testid={`roadmap-node-${testId}`}
      data-kind={node.kind}
      data-done={node.kind === "task" ? String(done) : undefined}
      data-collapsed={hasToggle ? String(collapsed) : undefined}
    >
      {node.href ? (
        <Link
          href={node.href}
          className="rb-roadmap-body"
          title={tooltip}
          aria-label={label}
          draggable={false}
        >
          {body}
        </Link>
      ) : (
        <div className="rb-roadmap-body" title={tooltip} aria-label={label}>
          {body}
        </div>
      )}
      {hasToggle && (
        <button
          type="button"
          className="rb-roadmap-toggle"
          data-testid={`roadmap-toggle-${testId}`}
          aria-expanded={!collapsed}
          aria-label={`하위 ${childCount}개 ${collapsed ? "펼치기" : "접기"}`}
          title={collapsed ? "펼치기" : "접기"}
          onClick={onToggleClick}
        >
          <ChevronIcon />
          <span className="rb-roadmap-toggle-count">{childCount}</span>
        </button>
      )}
    </div>
  );
}
