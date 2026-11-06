"use client";

import {
  BookOpen,
  Circle,
  CircleCheck,
  CircleDot,
  Code2,
  Diamond,
  ExternalLink,
  FileText,
  GraduationCap,
  PlayCircle,
  ScrollText,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui/cn";
import {
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  type Priority,
  type RoadmapItem,
  type Status,
} from "./model";

const KIND_ICON: Record<string, LucideIcon> = {
  book: BookOpen,
  course: GraduationCap,
  paper: ScrollText,
  video: PlayCircle,
  code: Code2,
  doc: FileText,
};

const KIND_LABEL: Record<string, string> = {
  book: "책",
  course: "강의",
  paper: "논문",
  video: "영상",
  code: "코드",
  doc: "문서",
};

const STATUS_ICON: Record<Status, LucideIcon> = {
  todo: Circle,
  doing: CircleDot,
  done: CircleCheck,
};

/** Shared status glyph (tree, legend, panel): ring, dotted ring, checked ring. Decorative. */
export function StatusIcon({ status, size = 14 }: { status: Status; size?: number }) {
  const Icon = STATUS_ICON[status];
  return <Icon size={size} aria-hidden className="ip-status-icon" data-status={status} />;
}

/** Shared priority mark: filled diamond (필수), outline diamond (추천), nothing (선택). */
export function PriorityMark({ priority }: { priority: Priority }) {
  if (priority === "optional") return null;
  return (
    <Diamond
      size={10}
      aria-hidden
      className="ip-priority-mark"
      fill={priority === "essential" ? "currentColor" : "none"}
      strokeWidth={2.5}
    />
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export interface ItemPanelProps {
  item: RoadmapItem | null;
  onClose: () => void;
  /** Called when a status button is pressed. Omit to render the status read-only. */
  onStatusChange?: (itemId: string, status: Status) => void;
  /** Disables the status buttons while the update is in flight. */
  pending?: boolean;
  /** Opens a child/grandchild in this panel. Omit to list them as plain text. */
  onSelect?: (itemId: string) => void;
  className?: string;
}

/** How many levels below the item the panel lists (child, grandchild). */
const SUBTREE_DEPTH = 2;

/** Nested list of the item's children and grandchildren, same glyphs as the tree. */
function SubTree({
  nodes,
  depth,
  onSelect,
}: {
  nodes: RoadmapItem[];
  depth: number;
  onSelect?: (itemId: string) => void;
}) {
  return (
    <ul className="ip-sub-list" data-depth={depth}>
      {nodes.map((n) => {
        const deeper = depth >= SUBTREE_DEPTH && n.children.length > 0;
        const body = (
          <>
            <StatusIcon status={n.status} size={14} />
            <span className="sr-only">{STATUS_LABEL[n.status]}, </span>
            {n.priority ? <PriorityMark priority={n.priority} /> : null}
            {n.priority ? <span className="sr-only">{PRIORITY_LABEL[n.priority]}, </span> : null}
            <span className="ip-sub-title">{n.title}</span>
            {deeper ? (
              <span className="ip-sub-more">
                {n.progress.done}/{n.progress.total}
                <span className="sr-only"> 하위 항목 완료</span>
              </span>
            ) : null}
          </>
        );
        return (
          <li
            key={n.id}
            className="ip-sub-node"
            data-priority={n.priority ?? undefined}
            data-status={n.status}
          >
            {onSelect ? (
              <button type="button" className="ip-sub-row" onClick={() => onSelect(n.id)}>
                {body}
              </button>
            ) : (
              <span className="ip-sub-row">{body}</span>
            )}
            {!deeper && n.children.length > 0 ? (
              <SubTree nodes={n.children} depth={depth + 1} onSelect={onSelect} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Side panel for one roadmap item: description, resource links, status switch. */
export default function ItemPanel({
  item,
  onClose,
  onStatusChange,
  pending = false,
  onSelect,
  className,
}: ItemPanelProps) {
  if (!item) return null;

  return (
    <aside
      aria-label={`${item.title} 상세`}
      data-testid="rm-item-panel"
      data-status={item.status}
      data-priority={item.priority ?? undefined}
      aria-busy={pending || undefined}
      className={cn("ip-root", className)}
    >
      <header className="ip-head">
        <div className="ip-head-text">
          {item.priority ? (
            <span className="ip-chip" data-priority={item.priority}>
              <PriorityMark priority={item.priority} />
              {PRIORITY_LABEL[item.priority]}
            </span>
          ) : null}
          <h2 className="ip-title">{item.title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="ip-close">
          <X size={16} aria-hidden />
        </button>
      </header>

      <div role="radiogroup" aria-label="상태 바꾸기" className="ip-status">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            data-testid={`rm-status-btn-${s}`}
            data-status={s}
            aria-checked={item.status === s}
            disabled={pending || !onStatusChange}
            onClick={() => {
              if (item.status !== s) onStatusChange?.(item.id, s);
            }}
            className="ip-status-btn"
          >
            <StatusIcon status={s} size={15} />
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {item.description ? <p className="ip-desc">{item.description}</p> : null}

      {item.children.length > 0 ? (
        <section aria-labelledby={`ip-sub-${item.id}`} className="ip-sub">
          <h3 id={`ip-sub-${item.id}`} className="ip-section-title">
            하위 항목 {item.progress.done}/{item.progress.total} 완료
          </h3>
          <SubTree nodes={item.children} depth={1} onSelect={onSelect} />
        </section>
      ) : null}

      {item.resources.length > 0 ? (
        <section aria-labelledby={`ip-res-${item.id}`} className="ip-resources">
          <h3 id={`ip-res-${item.id}`} className="ip-section-title">
            자료 {item.resources.length}개
          </h3>
          <ul className="ip-res-list">
            {item.resources.map((r, i) => {
              const Icon = KIND_ICON[r.kind] ?? FileText;
              const host = hostOf(r.url);
              return (
                <li key={`${r.url}-${i}`}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="ip-res">
                    <span className="ip-res-kind" title={KIND_LABEL[r.kind] ?? "문서"}>
                      <Icon size={15} aria-hidden />
                    </span>
                    <span className="sr-only">{KIND_LABEL[r.kind] ?? "문서"}: </span>
                    <span className="ip-res-text">
                      <span className="ip-res-title">{r.title}</span>
                      {host ? <span className="ip-res-host">{host}</span> : null}
                    </span>
                    <ExternalLink size={13} aria-hidden className="ip-res-out" />
                    <span className="sr-only">(새 탭)</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
