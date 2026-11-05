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
      title="노트"
      action={
        list.length && !archived ? (
          <LinkButton href={href} variant="ghost" size="sm">
            새 노트
          </LinkButton>
        ) : null
      }
    >
      {list.length ? (
        <RowList>
          {list.map((note) => (
            <ListRow key={note.id}>
              <Link href={`/notes/${note.id}`} className="min-w-0 flex-1 truncate hover:underline">
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
