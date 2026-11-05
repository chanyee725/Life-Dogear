import Link from "next/link";
import { seoulDate } from "@/components/calendar/model";
import { EmptyAdd, formatDate, LinkButton, ListRow, RowList, Section } from "@/components/ui";
import { AddTaskButton } from "@/components/tasks/AddTaskReveal";
import { notes, tasks } from "@/lib/repo";
import type { TaskParent } from "@/lib/repo/tasks";

/** Item whose notes are shown: projects and goals link notes, areas also own them (`areaId`). */
export type NotesOwner = { type: "project" | "goal" | "area"; id: string };

export const newNoteHref = (owner: NotesOwner) => `/notes/new?${owner.type}=${owner.id}`;

/**
 * "노트" section of a project, goal or area page (PLAN-PAGES 1): its non-archived notes,
 * newest edit first. "새 노트" links the new note to this item when it is saved.
 */
export async function ItemNotes({
  owner,
  archived = false,
  taskParent,
}: {
  owner: NotesOwner;
  archived?: boolean;
  /** Project/goal: show `＋ 할 일` here while its 할 일 section is hidden (no tasks). */
  taskParent?: NonNullable<TaskParent>;
}) {
  const [list, taskCount] = await Promise.all([
    notes.listForItem(owner),
    taskParent && !archived ? tasks.list({ parent: taskParent }).then((l) => l.length) : 1,
  ]);
  const href = newNoteHref(owner);
  return (
    <Section
      id="item-notes"
      title={
        <span className="flex items-baseline gap-2">
          노트
          {list.length ? (
            <span className="text-xs font-normal text-muted tabular-nums">{list.length}</span>
          ) : null}
        </span>
      }
      action={
        archived || (!list.length && taskCount > 0) ? null : (
          // -mr-2: the last button's text lines up with the list's right edge.
          <div className="-mr-2 flex items-center">
            {taskCount === 0 ? <AddTaskButton /> : null}
            {list.length ? (
              <LinkButton href={href} variant="ghost" size="sm">
                새 노트
              </LinkButton>
            ) : null}
          </div>
        )
      }
    >
      {list.length ? (
        <RowList>
          {list.map((note) => (
            <ListRow
              key={note.id}
              className="relative gap-4 py-2.5 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-hover has-[a:focus-visible]:bg-hover"
            >
              {/* after:inset-0 stretches the link over the whole row (bigger hit area, one tab stop). */}
              <Link
                href={`/notes/${note.id}`}
                className="min-w-0 flex-1 truncate text-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-accent"
              >
                {note.title}
              </Link>
              <time dateTime={note.updatedAt} className="shrink-0 text-xs text-muted tabular-nums">
                {/* Seoul day: the server may run in UTC (Vercel). */}
                {formatDate(seoulDate(note.updatedAt))}
              </time>
            </ListRow>
          ))}
        </RowList>
      ) : archived ? null : (
        <EmptyAdd compact href={href}>＋ 새 노트</EmptyAdd>
      )}
    </Section>
  );
}
