import Link from "next/link";
import { seoulDate } from "@/components/calendar/model";
import { EmptyAdd, formatDate, LinkButton, ListRow, RowList, Section } from "@/components/ui";
import { notes } from "@/lib/repo";

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
}: {
  owner: NotesOwner;
  archived?: boolean;
}) {
  const list = await notes.listForItem(owner);
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
        list.length && !archived ? (
          // -mr-2: the button's text lines up with the list's right edge.
          <LinkButton href={href} variant="ghost" size="sm" className="-mr-2">
            새 노트
          </LinkButton>
        ) : null
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
                className="min-w-0 flex-1 truncate text-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
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
        <EmptyAdd href={href}>＋ 새 노트</EmptyAdd>
      )}
    </Section>
  );
}
