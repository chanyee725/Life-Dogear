import Link from "next/link";
import type { ReactNode } from "react";
import { cn, EmptyAdd, TagChip } from "@/components/ui";
import { PROJECT_STAGE } from "@/lib/enums";
import type { Project, StageColumn } from "@/lib/repo/projects";
import { seoulToday } from "./today";
import { dueChip } from "./project-card";
import { itemPath } from "@/lib/item-path";

/**
 * Research projects by stage (submitted excluded); used inside the home
 * "진행 중인 프로젝트" tabs. Stage changes happen on the detail page.
 *
 * The full pipeline is a one-line strip (every stage with its count); only stages that
 * hold projects get a column, and those columns share the section width instead of
 * scrolling sideways past empty ones.
 */
export function ProjectKanbanBoard({ columns }: { columns: StageColumn[] }) {
  const total = columns.reduce((sum, c) => sum + c.items.length, 0);
  const filled = columns.filter((c) => c.items.length > 0);

  if (total === 0) {
    return (
      <EmptyAdd compact href="/projects/new">
        ＋ 새 연구
      </EmptyAdd>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <StageStrip columns={columns} />
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {filled.map((column) => (
          <KanbanColumn
            key={column.stage}
            label={PROJECT_STAGE.label(column.stage)}
            count={column.items.length}
          >
            {column.items.map((project) => (
              <KanbanCard key={project.id} project={project} />
            ))}
          </KanbanColumn>
        ))}
      </ol>
    </div>
  );
}

/** Every stage in order with its count; empty stages are faint so the pipeline stays readable. */
function StageStrip({ columns }: { columns: StageColumn[] }) {
  return (
    <ol
      aria-label="연구 단계별 개수"
      className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs"
    >
      {columns.map((column, i) => {
        const count = column.items.length;
        return (
          <li key={column.stage} className="flex items-center gap-1">
            {i > 0 ? <span aria-hidden className="h-px w-3 bg-border-strong" /> : null}
            <span className={cn(count ? "text-fg" : "text-faint")}>
              {PROJECT_STAGE.label(column.stage)}
              <span className={cn("ml-1 tabular-nums", count ? "font-medium" : "")}>{count}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One kanban column: a labelled, counted list of cards (shared by the home and area boards). */
export function KanbanColumn({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <li
      aria-label={`${label} ${count}건`}
      className={cn(
        "flex flex-col gap-2 rounded-lg p-2",
        count ? "bg-surface" : "bg-surface/40 py-1.5",
      )}
    >
      <div className="flex items-center justify-between px-1 text-xs">
        <span className={cn(count ? "font-medium text-fg" : "text-faint")}>{label}</span>
        <span className={cn("tabular-nums", count ? "text-muted" : "text-faint/70")}>{count}</span>
      </div>
      {children}
    </li>
  );
}

/** A project card linking to its detail page; `meta` adds a line (e.g. its goal). */
export function KanbanCard({
  project,
  meta,
  today,
  hideTag,
}: {
  project: Pick<Project, "id" | "title" | "dueDate" | "tags">;
  meta?: ReactNode;
  /** Seoul date (`YYYY-MM-DD`); defaults to now. */
  today?: string;
  /** Tag to leave out (the area's own name on its board). */
  hideTag?: string;
}) {
  const tags = project.tags.filter((t) => t !== hideTag);
  return (
    <Link
      href={itemPath("projects", project.id, project.title)}
      className="flex flex-col gap-1.5 rounded-md border border-border bg-bg p-3 text-sm transition-colors hover:border-border-strong"
    >
      <span className="line-clamp-2 font-medium text-fg">{project.title}</span>
      {meta}
      {project.dueDate ? (
        <DueText dueDate={project.dueDate} today={today ?? seoulToday(new Date()).today} />
      ) : null}
      {tags.length ? (
        <span className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((t) => (
            <TagChip key={t}>#{t}</TagChip>
          ))}
        </span>
      ) : null}
    </Link>
  );
}

/** `D-24 · 11.29`, red once overdue (same format as the home project cards). */
function DueText({ dueDate, today }: { dueDate: string; today: string }) {
  const due = dueChip(dueDate, today);
  if (!due) return null;
  return (
    <span
      className={cn("text-xs tabular-nums", due.tone === "red" ? "text-tone-red-fg" : "text-muted")}
    >
      <span aria-hidden="true">{due.text}</span>
      <span className="sr-only">{due.label}</span>
    </span>
  );
}
