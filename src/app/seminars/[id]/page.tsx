import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidItemId } from "@/lib/ids";
import { ArchiveButton, ArchivedNotice } from "@/components/fields/ArchiveButton";
import { DeleteItemButton } from "@/components/fields/DeleteItemButton";
import { ItemForm } from "@/components/fields/ItemForm";
import { ConnectedWithGraph } from "@/components/graph/ConnectedWithGraph";
import { Page } from "@/components/shell/PageHeader";
import { seminars, tags } from "@/lib/repo";
import { deleteSeminar, updateSeminar } from "../actions";
import { SeminarFields } from "../SeminarFields";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const seminar = isValidItemId(id) ? await seminars.get(id) : null;
  return { title: seminar?.title ?? "세미나" };
}

export default async function SeminarDetailPage({ params }: Props) {
  const { id } = await params;
  if (!isValidItemId(id)) notFound();
  const [seminar, allTags] = await Promise.all([seminars.get(id), tags.listAll()]);
  if (!seminar) notFound();

  return (
    <Page className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        {seminar.archivedAt ? <ArchivedNotice item={{ type: "seminar", id: seminar.id }} /> : null}
        <ItemForm
          mode="edit"
          action={updateSeminar.bind(null, seminar.id)}
          basePath="/seminars"
          backLabel="세미나"
          actions={
            <>
              {seminar.archivedAt ? null : (
                <ArchiveButton
                  item={{ type: "seminar", id: seminar.id }}
                  archived={false}
                  redirectTo="/seminars"
                />
              )}
              <DeleteItemButton
                action={deleteSeminar.bind(null, seminar.id)}
                redirectTo="/seminars"
                itemLabel="이 세미나"
              />
            </>
          }
        >
          <SeminarFields
            editorKey={seminar.id}
            tagSuggestions={allTags.map((t) => t.name)}
            values={{
              title: seminar.title,
              date: seminar.date,
              speaker: seminar.speaker,
              hostVenue: seminar.hostVenue,
              kind: seminar.kind,
              keyLine: seminar.keyLine,
              materialUrl: seminar.materialUrl,
              body: seminar.body,
              tags: seminar.tags,
            }}
          />
        </ItemForm>
      </div>
      <ConnectedWithGraph item={{ type: "seminar", id: seminar.id }} />
    </Page>
  );
}
