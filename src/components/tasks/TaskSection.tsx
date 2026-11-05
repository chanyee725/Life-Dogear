import { Section } from "@/components/ui/Card";
import { tasks } from "@/lib/repo";
import type { TaskParent } from "@/lib/repo/tasks";
import { seoulDate } from "@/components/calendar/model";
import { TaskList } from "./TaskList";

/**
 * "할 일" section of a project or goal page (today.md 2). An archived parent still
 * shows its tasks, but takes no new ones.
 */
export async function TaskSection({
  parent,
  archived = false,
}: {
  parent: NonNullable<TaskParent>;
  archived?: boolean;
}) {
  const list = await tasks.list({ parent, includeArchivedParents: true });
  const done = list.filter((t) => t.doneAt).length;
  return (
    <Section
      title={
        <span className="flex items-baseline gap-2">
          할 일
          {list.length ? (
            <span className="text-xs font-normal text-muted tabular-nums">
              {done}/{list.length}
            </span>
          ) : null}
        </span>
      }
      className="gap-2"
    >
      <TaskList
        tasks={list}
        today={seoulDate()}
        addTo={archived ? undefined : { parent }}
        reorderable={!archived}
      />
    </Section>
  );
}
