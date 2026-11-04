import Link from "next/link";
import { TaskList } from "@/components/tasks/TaskList";
import type { Task } from "@/lib/repo/tasks";
import { Section, SectionHeader } from "@/components/ui";
import { TODAY_MAX, WEEK_MAX } from "./today";

const actionClass = "text-xs text-muted hover:text-fg";

function More({ count, href }: { count: number; href: string }) {
  if (count <= 0) return null;
  return (
    <Link href={href} className="px-1.5 text-xs text-muted tabular-nums hover:text-fg">
      + {count}개 더
    </Link>
  );
}

/**
 * "오늘 할 일" in the home today panel (today.md 4.2): overdue first (with their due date),
 * then today's, then the finished ones struck through — the shared task rows (check, edit,
 * menu). The add input follows it in the panel. Always shown, so the input keeps its heading.
 */
export function TodayTasks({
  overdue,
  dueToday,
  done = [],
  today,
}: {
  overdue: Task[];
  dueToday: Task[];
  /** Today's tasks already finished: listed below, struck through. */
  done?: Task[];
  today: string;
}) {
  const all = [...overdue, ...dueToday];
  const href = "/tasks?tab=today";
  return (
    <section aria-labelledby="today-heading" className="flex flex-col gap-1">
      <SectionHeader
        as="h3"
        id="today-heading"
        title={
          <>
            오늘 할 일
            {all.length ? (
              <span className="ml-2 text-xs font-normal tabular-nums">
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
            모두 보기
          </Link>
        }
        className="h-8"
      />
      {all.length || done.length ? (
        <div className="flex flex-col">
          <TaskList
            tasks={[...all.slice(0, TODAY_MAX), ...done]}
            today={today}
            label="오늘 할 일"
            showParent
            dueMode="overdue"
            showCompleted
            doneOpen
          />
          <More count={all.length - TODAY_MAX} href={href} />
        </div>
      ) : null}
    </section>
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
          모두 보기
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
