import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchiveButton, ArchivedNotice } from "@/components/fields/ArchiveButton";
import { DeleteItemButton } from "@/components/fields/DeleteItemButton";
import { ItemForm } from "@/components/fields/ItemForm";
import { ConnectedWithGraph } from "@/components/graph/ConnectedWithGraph";
import { Page } from "@/components/shell/PageHeader";
import { isValidItemId } from "@/lib/ids";
import { NOTE_SOURCE_KIND } from "@/lib/enums";
import { areas, notes, tags } from "@/lib/repo";
import { areaOptionsFor } from "../../projects/ProjectFields";
import { deleteNote, updateNote } from "../actions";
import { NoteFields } from "../NoteFields";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const note = isValidItemId(id) ? await notes.get(id) : null;
  return { title: note?.title ?? "노트" };
}

export default async function NoteDetailPage({ params }: Props) {
  const { id } = await params;
  if (!isValidItemId(id)) notFound();
  const [note, allTags, areaList] = await Promise.all([
    notes.get(id),
    tags.listAll({ visibleOnly: true }),
    areas.list({ includeArchived: true }),
  ]);
  if (!note) notFound();
  const ref = { type: "note" as const, id: note.id };

  return (
    <Page className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        {note.archivedAt ? <ArchivedNotice item={ref} /> : null}
        <ItemForm
          mode="edit"
          action={updateNote.bind(null, note.id)}
          basePath="/notes"
          backLabel="노트"
          actions={
            <>
              {note.archivedAt ? null : (
                <ArchiveButton item={ref} archived={false} redirectTo="/notes" />
              )}
              <DeleteItemButton
                action={deleteNote.bind(null, note.id)}
                redirectTo="/notes"
                itemLabel="이 노트"
              />
            </>
          }
        >
          <NoteFields
            editorKey={note.id}
            tagSuggestions={allTags.map((t) => t.name)}
            areaOptions={areaOptionsFor(areaList, note.areaId)}
            values={{
              title: note.title,
              sourceKind: NOTE_SOURCE_KIND.is(note.sourceKind) ? note.sourceKind : null,
              sourceTitle: note.sourceTitle ?? "",
              sourceUrl: note.sourceUrl ?? "",
              areaId: note.areaId,
              body: note.body,
              tags: note.tags,
            }}
          />
        </ItemForm>
      </div>
      <ConnectedWithGraph item={ref} />
    </Page>
  );
}
