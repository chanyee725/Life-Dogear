"use client";

import {
  BookOpen,
  Code2,
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

export interface ItemPanelProps {
  item: RoadmapItem | null;
  onClose: () => void;
  /** Called when a status button is pressed. Omit to render the status read-only. */
  onStatusChange?: (itemId: string, status: Status) => void;
  /** Disables the status buttons while the update is in flight. */
  pending?: boolean;
  className?: string;
}

/** Side panel for one roadmap item: description, resource links, status switch. */
export default function ItemPanel({
  item,
  onClose,
  onStatusChange,
  pending = false,
  className,
}: ItemPanelProps) {
  if (!item) return null;

  return (
    <aside
      aria-label={`${item.title} 상세`}
      className={cn(
        "flex flex-col gap-4 border-l border-[var(--rb-border)] bg-[var(--rb-bg)] p-4",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--rb-fg)]">{item.title}</h2>
          <p className="mt-0.5 text-xs text-[var(--rb-muted)]">{PRIORITY_LABEL[item.priority]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded p-1 text-[var(--rb-muted)] hover:bg-[var(--rb-hover)]"
        >
          <X size={16} aria-hidden />
        </button>
      </header>

      {item.description ? (
        <p className="whitespace-pre-wrap text-sm text-[var(--rb-fg)]">{item.description}</p>
      ) : null}

      <div role="radiogroup" aria-label="상태 바꾸기" className="flex gap-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={item.status === s}
            disabled={pending || !onStatusChange}
            onClick={() => {
              if (item.status !== s) onStatusChange?.(item.id, s);
            }}
            className={cn(
              "rounded border border-[var(--rb-border)] px-2.5 py-1 text-xs disabled:opacity-50",
              item.status === s
                ? "bg-[var(--rb-accent)] text-[var(--rb-accent-fg)]"
                : "text-[var(--rb-fg)] hover:bg-[var(--rb-hover)]",
            )}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {item.resources.length > 0 ? (
        <section aria-label="자료">
          <h3 className="mb-1 text-xs font-medium text-[var(--rb-muted)]">자료</h3>
          <ul className="flex flex-col gap-1">
            {item.resources.map((r, i) => {
              const Icon = KIND_ICON[r.kind] ?? FileText;
              return (
                <li key={`${r.url}-${i}`}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded px-1.5 py-1 text-sm text-[var(--rb-fg)] hover:bg-[var(--rb-hover)]"
                  >
                    <Icon size={14} aria-hidden className="shrink-0 text-[var(--rb-muted)]" />
                    <span className="sr-only">{KIND_LABEL[r.kind] ?? "문서"}: </span>
                    <span className="truncate">{r.title}</span>
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
