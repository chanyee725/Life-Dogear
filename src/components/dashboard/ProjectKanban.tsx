import Link from "next/link";
import { buttonClass, cn, TagChip } from "@/components/ui";
import { PROJECT_STAGE } from "@/lib/enums";
import type { StageColumn } from "@/lib/repo/projects";
import { DashboardEmpty } from "./DashboardSection";
import { formatDate } from "./format";
import { NextAction } from "./NextAction";

/**
 * Research projects by stage (submitted excluded); used inside the home
 * "진행 중인 프로젝트" tabs. Stage changes happen on the detail page.
 */
export function ProjectKanbanBoard({ columns }: { columns: StageColumn[] }) {
  const total = columns.reduce((sum, c) => sum + c.items.length, 0);

  return total === 0 ? (
    <DashboardEmpty>
      진행 중인 연구가 없습니다.{" "}
      <Link href="/projects/new" className={buttonClass("ghost", "sm", "align-baseline")}>
        새 연구 만들기
      </Link>
    </DashboardEmpty>
  ) : (
    // Right-edge fade hints that more stages scroll in; the trailing pr-8 keeps the
    // last column clear of the fade once scrolled to the end.
    <div className="-mx-1 overflow-x-auto px-1 pb-2 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]">
      <ol className="flex min-w-max gap-3 pr-8">
        {columns.map((column) => (
          <li
            key={column.stage}
            aria-label={`${PROJECT_STAGE.label(column.stage)} ${column.items.length}건`}
            className={cn(
              "flex shrink-0 flex-col gap-2 rounded-lg bg-surface p-2",
              // Empty stages stay as slim placeholders so filled ones get the room.
              column.items.length ? "w-52" : "w-24",
            )}
          >
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="font-medium text-muted">{PROJECT_STAGE.label(column.stage)}</span>
              <span className="text-muted tabular-nums">{column.items.length}</span>
            </div>
            {column.items.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex flex-col gap-1.5 rounded-md border border-border bg-bg p-3 text-sm transition-colors hover:border-border-strong"
              >
                <span className="line-clamp-2 font-medium text-fg">{project.title}</span>
                <NextAction value={project.nextAction} />
                {project.dueDate ? (
                  <span className="text-xs text-muted">마감 {formatDate(project.dueDate)}</span>
                ) : null}
                {project.tags.length ? (
                  <span className="flex flex-wrap gap-1">
                    {project.tags.slice(0, 3).map((t) => (
                      <TagChip key={t}>#{t}</TagChip>
                    ))}
                  </span>
                ) : null}
              </Link>
            ))}
          </li>
        ))}
      </ol>
    </div>
  );
}
