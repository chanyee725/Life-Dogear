import Link from "next/link";
import { seoulDate } from "@/components/calendar/model";
import { TagList } from "@/components/list/TagList";
import {
  cardClass,
  cardLinkClass,
  cn,
  EmptyAdd,
  formatDate,
  LinkButton,
  Section,
} from "@/components/ui";
import { AddTaskButton } from "@/components/tasks/AddTaskReveal";
import { notes, tasks } from "@/lib/repo";
import type { TaskParent } from "@/lib/repo/tasks";
import { itemPath } from "@/lib/item-path";

/** Item whose notes are shown: projects and goals link notes, areas also own them (`areaId`). */
export type NotesOwner = { type: "project" | "goal" | "area"; id: string };

// Same shape as the home 프로젝트 cards (GeneralProjects.tsx).
const noteCard = cn(
  cardClass,
  cardLinkClass,
  "flex h-full min-h-20 flex-col gap-2 rounded-md p-3 text-sm",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
);

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
      title="노트"
      count={list.length || undefined}
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
        // Card grid like the home 프로젝트 cards, so a few notes don't leave a wide blank row.
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((note) => (
            <li key={note.id}>
              <Link href={itemPath("notes", note.id, note.title)} className={noteCard}>
                <span className="line-clamp-2 font-medium text-fg">{note.title}</span>
                <span className="mt-auto flex flex-wrap items-center gap-1.5">
                  <time dateTime={note.updatedAt} className="text-xs text-muted tabular-nums">
                    {/* Seoul day: the server may run in UTC (Vercel). */}
                    {formatDate(seoulDate(note.updatedAt))}
                  </time>
                  <TagList tags={note.tags} max={2} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : archived ? null : (
        <EmptyAdd compact href={href}>
          ＋ 새 노트
        </EmptyAdd>
      )}
    </Section>
  );
}
