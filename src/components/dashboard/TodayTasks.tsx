import Link from "next/link";
import type { ReactNode } from "react";
import { formatDue } from "@/components/tasks/format";
import { cn } from "@/components/ui";
import type { Task } from "@/lib/repo/tasks";
import { DashboardSection } from "./DashboardSection";
import { taskParentHref, TODAY_MAX, WEEK_MAX } from "./today";

const actionClass = "text-[13px] text-muted hover:text-fg";

/**
 * One task row (today.md 2.1 without handle/menu): title, parent link, due date.
 * Read-only on home until the shared `TaskList` row lands.
 */
function TaskRow({
  task,
  today,
  showDue,
  dense,
}: {
  task: Task;
  today: string;
  showDue: boolean;
  dense?: boolean;
}) {
  const href = taskParentHref(task);
  const due = showDue ? formatDue(task.dueDate, today) : null;
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-md px-1.5 hover:bg-hover",
        dense ? "h-8" : "h-9",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-sm text-fg">{task.title}</span>
      {href && task.parentTitle ? (
        <Link href={href} className="max-w-40 truncate text-xs text-muted hover:text-fg">
          {task.parentTitle}
        </Link>
      ) : null}
      {due ? (
        <span className={due.className} title={due.label} aria-label={due.label}>
          {due.text}
        </span>
      ) : null}
    </li>
  );
}

function More({ count, href }: { count: number; href: string }) {
  if (count <= 0) return null;
  return (
    <Link href={href} className="px-1.5 text-xs text-muted tabular-nums hover:text-fg">
      + {count}개 더
    </Link>
  );
}

/** Home "오늘" (4.2): overdue first (with their due date), then today's. Always shown. */
export function TodayTasks({
  overdue,
  dueToday,
  today,
}: {
  overdue: Task[];
  dueToday: Task[];
  today: string;
}) {
  const all = [...overdue, ...dueToday];
  const shown = all.slice(0, TODAY_MAX);
  const href = "/tasks?tab=today";
  const title: ReactNode = (
    <span className="ml-2 text-xs font-normal text-muted tabular-nums">
      {dueToday.length}
      {overdue.length ? (
        <>
          {" · 지남 "}
          <span className="text-tone-red-fg">{overdue.length}</span>
        </>
      ) : null}
    </span>
  );
  return (
    <DashboardSection
      id="today"
      title="오늘"
      titleExtra={all.length ? title : undefined}
      action={
        <Link href={href} className={actionClass}>
          모두 보기 →
        </Link>
      }
    >
      {shown.length ? (
        <div className="flex flex-col">
          <ul aria-label="오늘 할 일" className="flex flex-col">
            {shown.map((t) => (
              <TaskRow key={t.id} task={t} today={today} showDue={t.dueDate! < today} />
            ))}
          </ul>
          <More count={all.length - shown.length} href={href} />
        </div>
      ) : (
        <p className="text-[13px] text-muted">오늘 마감인 할 일이 없습니다.</p>
      )}
    </DashboardSection>
  );
}

/** Home "이번 주" (4.1 #3): due tomorrow through Sunday. Hidden when empty. */
export function WeekTasks({ tasks, today }: { tasks: Task[]; today: string }) {
  if (!tasks.length) return null;
  const href = "/tasks?tab=week";
  return (
    <DashboardSection
      id="this-week"
      title="이번 주"
      action={
        <Link href={href} className={actionClass}>
          모두 보기 →
        </Link>
      }
    >
      <div className="flex flex-col">
        <ul aria-label="이번 주 할 일" className="flex flex-col">
          {tasks.slice(0, WEEK_MAX).map((t) => (
            <TaskRow key={t.id} task={t} today={today} showDue dense />
          ))}
        </ul>
        <More count={tasks.length - WEEK_MAX} href={href} />
      </div>
    </DashboardSection>
  );
}
