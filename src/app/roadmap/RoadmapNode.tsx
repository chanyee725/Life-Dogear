"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { AreaIcon, GoalIcon, ProjectIcon } from "@/components/shell/icons";
import { PROJECT_STATUS } from "@/lib/enums";
import type { RoadmapKind, RoadmapNode } from "@/lib/repo/roadmap-types";
import {
  formatRoadmapDate,
  goalStatusLabel,
  progressPercent,
  projectStatusLabel,
  type RoadmapCounts,
} from "./roadmapStats";

export interface RoadmapNodeBoxProps {
  node: RoadmapNode;
  /** Box size in layout px (from the layout's placed node). */
  width: number;
  height: number;
  /** Children hidden. Only matters when the node has children. */
  collapsed?: boolean;
  /** Collapse / expand. Without it no toggle button is shown. */
  onToggle?: () => void;
  /** Descendant counts, shown on area boxes. */
  counts?: RoadmapCounts;
  /** Branch colour slot (`0`..`5`, or `none`), see .rb-roadmap-node[data-tone]. */
  tone?: string;
  /** Faded: another branch is hovered or focused. */
  dim?: boolean;
  /** Pointer entered or keyboard focus moved inside the box. */
  onFocusIn?: () => void;
  /** Pointer left the box. */
  onFocusOut?: () => void;
  /** Placement from the layout, e.g. `{ transform: translate(x, y) }`. */
  style?: CSSProperties;
  className?: string;
}

export const KIND_LABEL: Record<RoadmapKind, string> = {
  area: "영역",
  goal: "목표",
  project: "프로젝트",
  task: "할 일",
};

/** Round check: empty, or filled with a tick when the task is done. */
export function TaskCheck({ done }: { done: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle
        cx="7"
        cy="7"
        r="5.75"
        fill={done ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.3"
      />
      {done && (
        <path
          d="m4.5 7.1 1.7 1.6 3.3-3.4"
          fill="none"
          stroke="var(--rb-bg)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
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

/** Goal progress ring; the percent sits in the middle (or a dash when unknown). */
function ProgressRing({ percent }: { percent: number | null }) {
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <span
      className="rb-roadmap-ring"
      role={percent == null ? undefined : "progressbar"}
      aria-label={percent == null ? undefined : "진행률"}
      aria-valuemin={percent == null ? undefined : 0}
      aria-valuemax={percent == null ? undefined : 100}
      aria-valuenow={percent ?? undefined}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <circle className="rb-roadmap-ring-track" cx="16" cy="16" r={r} />
        {percent != null && percent > 0 && (
          <circle
            className="rb-roadmap-ring-fill"
            cx="16"
            cy="16"
            r={r}
            strokeDasharray={`${(c * percent) / 100} ${c}`}
            transform="rotate(-90 16 16)"
          />
        )}
      </svg>
      <span className="rb-roadmap-ring-label">
        {percent == null ? <GoalIcon /> : percent}
      </span>
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <span
      className="rb-roadmap-bar"
      role="progressbar"
      aria-label="진행률"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <span className="rb-roadmap-bar-fill" style={{ width: `${percent}%` }} />
    </span>
  );
}

function AreaBody({ node, counts }: { node: RoadmapNode; counts?: RoadmapCounts }) {
  const parts: string[] = [];
  if (counts?.goals) parts.push(`목표 ${counts.goals}`);
  if (counts?.projects) parts.push(`프로젝트 ${counts.projects}`);
  return (
    <>
      <span className="rb-roadmap-chip" aria-hidden="true">
        <AreaIcon />
      </span>
      <span className="rb-roadmap-text">
        <span className="rb-roadmap-title">{node.title}</span>
        <span className="rb-roadmap-meta">
          {parts.length ? (
            parts.map((p) => <span key={p}>{p}</span>)
          ) : (
            <span className="rb-roadmap-faint">아직 비어 있음</span>
          )}
        </span>
      </span>
    </>
  );
}

function GoalBody({ node }: { node: RoadmapNode }) {
  const percent = progressPercent(node);
  const period = formatRoadmapDate(node.due);
  const status = node.status && node.status !== "active" ? goalStatusLabel(node.status) : "";
  return (
    <>
      <ProgressRing percent={percent} />
      <span className="rb-roadmap-text">
        <span className="rb-roadmap-title">{node.title}</span>
        {(period || status) && (
          <span className="rb-roadmap-meta">
            {period && <span className="rb-roadmap-num">{period}</span>}
            {status && <span>{status}</span>}
          </span>
        )}
      </span>
    </>
  );
}

function ProjectBody({ node }: { node: RoadmapNode }) {
  const percent = progressPercent(node);
  const due = formatRoadmapDate(node.due);
  const status = projectStatusLabel(node.status);
  const tone = node.status ? PROJECT_STATUS.tone(node.status as never) : "gray";
  return (
    <>
      <span className="rb-roadmap-chip" aria-hidden="true">
        <ProjectIcon />
      </span>
      <span className="rb-roadmap-text">
        <span className="rb-roadmap-title">{node.title}</span>
        <span className="rb-roadmap-meta">
          {status && (
            <span className="rb-roadmap-status" data-tone={tone}>
              {status}
            </span>
          )}
          {percent != null && <ProgressBar percent={percent} />}
          {percent != null && <span className="rb-roadmap-num">{percent}%</span>}
          {due && <span className="rb-roadmap-num rb-roadmap-due">{due}</span>}
        </span>
      </span>
    </>
  );
}

function TaskBody({ node }: { node: RoadmapNode }) {
  return (
    <>
      <span className="rb-roadmap-check" aria-hidden="true">
        <TaskCheck done={!!node.done} />
      </span>
      <span className="rb-roadmap-title">{node.title}</span>
    </>
  );
}

/**
 * One roadmap box. Positioned by the caller (`style`), sized by `width` / `height`.
 * Each kind has its own shape: area card, goal with a progress ring, project with a
 * status badge and bar, task pill. The body links to `node.href`; the collapse button
 * sits beside the link (not inside it), so toggling never navigates.
 */
export function RoadmapNodeBox({
  node,
  width,
  height,
  collapsed = false,
  onToggle,
  counts,
  tone,
  dim = false,
  onFocusIn,
  onFocusOut,
  style,
  className,
}: RoadmapNodeBoxProps) {
  const testId = `${node.kind}-${node.id}`;
  const childCount = node.children.length;
  const hasToggle = childCount > 0 && !!onToggle;
  const done = node.kind === "task" && !!node.done;

  let body: ReactNode;
  switch (node.kind) {
    case "area":
      body = <AreaBody node={node} counts={counts} />;
      break;
    case "goal":
      body = <GoalBody node={node} />;
      break;
    case "project":
      body = <ProjectBody node={node} />;
      break;
    case "task":
      body = <TaskBody node={node} />;
      break;
  }

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
      data-tone={tone}
      data-dim={dim ? "true" : undefined}
      onPointerEnter={onFocusIn}
      onPointerLeave={onFocusOut}
      onFocus={onFocusIn}
    >
      {node.href ? (
        <Link
          href={node.href}
          className="rb-roadmap-body"
          title={node.title}
          aria-label={label}
          draggable={false}
        >
          {body}
        </Link>
      ) : (
        <div className="rb-roadmap-body" title={node.title} aria-label={label}>
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
