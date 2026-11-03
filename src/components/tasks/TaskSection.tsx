import { Section } from "@/components/ui/Card";
import { tasks } from "@/lib/repo";
import type { TaskParent } from "@/lib/repo/tasks";
import { localDate } from "./format";
import { TaskList } from "./TaskList";

const EMPTY_TEXT: Record<NonNullable<TaskParent>["type"], string> = {
  project: "아직 할 일이 없습니다. 다음에 할 일을 하나 적어 보세요.",
  goal: "아직 할 일이 없습니다. 연결된 프로젝트가 없다면 할 일로 진행률을 셉니다.",
  area: "아직 할 일이 없습니다.",
};

/**
 * "할 일" section of a project, goal or area page (today.md 2). An archived parent still
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
      className="gap-1"
    >
      <TaskList
        tasks={list}
        today={localDate()}
        addTo={archived ? undefined : { parent }}
        reorderable={!archived}
        emptyText={EMPTY_TEXT[parent.type]}
      />
    </Section>
  );
}
