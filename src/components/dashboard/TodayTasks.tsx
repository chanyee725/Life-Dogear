import Link from "next/link";
import type { Task } from "@/lib/repo/tasks";
import { DashboardEmpty, DashboardSection } from "./DashboardSection";
import { daysOverdue, shortDue, taskParentHref } from "./today";

type Group = { key: string; label: string; tasks: Task[]; due: (t: Task) => string };

function TaskLine({ task, due }: { task: Task; due: string }) {
  return (
    <li className="flex items-baseline gap-3 py-1.5 text-sm">
      <span className="min-w-0 flex-1 truncate text-fg">{task.title}</span>
      <Link
        href={taskParentHref(task)}
        className="max-w-[40%] shrink-0 truncate text-xs text-muted hover:text-fg"
      >
        {task.parentTitle ?? "소속 없음"}
      </Link>
      {due ? <span className="w-20 shrink-0 text-right text-xs text-muted tabular-nums">{due}</span> : null}
    </li>
  );
}

/** Home "할 일": overdue, today and the rest of this week. Each row links to its parent. */
export function TodayTasks({
  overdue,
  today,
  week,
  now,
}: {
  overdue: Task[];
  today: Task[];
  week: Task[];
  now: Date;
}) {
  const groups: Group[] = [
    {
      key: "overdue",
      label: "마감 지남",
      tasks: overdue,
      due: (t) => (t.dueDate ? `${daysOverdue(t.dueDate, now)}일 지남` : ""),
    },
    { key: "today", label: "오늘", tasks: today, due: () => "" },
    {
      key: "week",
      label: "이번 주 마감",
      tasks: week,
      due: (t) => (t.dueDate ? shortDue(t.dueDate) : ""),
    },
  ].filter((g) => g.tasks.length);

  return (
    <DashboardSection
      id="today-tasks"
      title="할 일"
      action={
        <Link href="/tasks" className="text-xs text-muted hover:text-fg">
          모두 보기
        </Link>
      }
    >
      {groups.length === 0 ? (
        <DashboardEmpty>오늘과 이번 주에 마감인 할 일이 없습니다.</DashboardEmpty>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col">
              <h3
                className={
                  g.key === "overdue"
                    ? "text-xs font-medium text-tone-red-fg"
                    : "text-xs font-medium text-muted"
                }
              >
                {g.label} <span className="tabular-nums">{g.tasks.length}</span>
              </h3>
              <ul className="divide-y divide-border">
                {g.tasks.map((t) => (
                  <TaskLine key={t.id} task={t} due={g.due(t)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}
