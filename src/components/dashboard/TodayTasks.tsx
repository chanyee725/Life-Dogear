import Link from "next/link";
import { TaskList } from "@/components/tasks/TaskList";
import type { Task } from "@/lib/repo/tasks";
import { Section } from "@/components/ui";
import { TODAY_MAX, WEEK_MAX } from "./today";

const actionClass = "text-[13px] text-muted hover:text-fg";

function More({ count, href }: { count: number; href: string }) {
  if (count <= 0) return null;
  return (
    <Link href={href} className="px-1.5 text-xs text-muted tabular-nums hover:text-fg">
      + {count}개 더
    </Link>
  );
}

/**
 * Home "오늘" (today.md 4.2): overdue first (with their due date), then today's, as the
 * shared task rows (check, edit, menu) with an add line for today. Always shown.
 */
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
  const href = "/tasks?tab=today";
  return (
    <Section
      id="today"
      title={
        <>
          오늘
          {all.length ? (
            <span className="ml-2 text-xs font-normal text-muted tabular-nums">
              {dueToday.length}
              {overdue.length ? (
                <>
                  {" · 지남 "}
                  <span className="text-tone-red-fg">{overdue.length}</span>
                </>
              ) : null}
            </span>
          ) : null}
        </>
      }
      action={
        <Link href={href} className={actionClass}>
          모두 보기 →
        </Link>
      }
    >
      <div className="flex flex-col">
        <TaskList
          tasks={all.slice(0, TODAY_MAX)}
          today={today}
          label="오늘 할 일"
          showParent
          dueMode="overdue"
          addTo={{ parent: null, dueDate: today }}
          showCompleted={false}
        />
        <More count={all.length - TODAY_MAX} href={href} />
      </div>
    </Section>
  );
}

/** Home "이번 주" (4.1 #3): due tomorrow through Sunday, checkable. Hidden when empty. */
export function WeekTasks({ tasks, today }: { tasks: Task[]; today: string }) {
  if (!tasks.length) return null;
  const href = "/tasks?tab=week";
  return (
    <Section
      id="this-week"
      title="이번 주"
      action={
        <Link href={href} className={actionClass}>
          모두 보기 →
        </Link>
      }
    >
      <div className="flex flex-col">
        <TaskList
          tasks={tasks.slice(0, WEEK_MAX)}
          today={today}
          label="이번 주 할 일"
          showParent
          showCompleted={false}
        />
        <More count={tasks.length - WEEK_MAX} href={href} />
      </div>
    </Section>
  );
}
