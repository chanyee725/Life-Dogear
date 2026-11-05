import { Section } from "@/components/ui/Card";
import { tasks } from "@/lib/repo";
import type { TaskParent } from "@/lib/repo/tasks";
import { seoulDate } from "@/components/calendar/model";
import { TaskList } from "./TaskList";
import { RevealOnAddTask } from "./AddTaskReveal";

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
  if (list.length === 0 && archived) return null;
  const section = (
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
        autoAdd={list.length === 0}
      />
    </Section>
  );
  // Empty: hidden until the notes header's `＋ 할 일` (AddTaskButton) is pressed.
  return <RevealOnAddTask hidden={list.length === 0}>{section}</RevealOnAddTask>;
}
