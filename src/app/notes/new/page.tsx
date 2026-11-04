import type { Metadata } from "next";
import { ItemForm } from "@/components/fields/ItemForm";
import { firstParam, type QueryParams } from "@/components/list/query";
import { Page } from "@/components/shell/PageHeader";
import { NOTE_SOURCE_KIND } from "@/lib/enums";
import { areas, tags } from "@/lib/repo";
import { areaOptionsFor } from "../../projects/ProjectFields";
import { createNote } from "../actions";
import { NoteFields } from "../NoteFields";

export const metadata: Metadata = { title: "새 노트" };
export const dynamic = "force-dynamic";

/** `?area=<id>` preselects the area, `?source=<kind>` the source kind. */
export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const [allTags, areaList] = await Promise.all([
    tags.listAll({ visibleOnly: true }),
    areas.list(),
  ]);
  const areaParam = firstParam(params, "area");
  const sourceParam = firstParam(params, "source");
  return (
    <Page>
      <ItemForm mode="create" action={createNote} basePath="/notes" backLabel="노트">
        <NoteFields
          editorKey="new"
          tagSuggestions={allTags.map((t) => t.name)}
          areaOptions={areaOptionsFor(areaList, null)}
          values={{
            title: "",
            sourceKind: NOTE_SOURCE_KIND.is(sourceParam) ? sourceParam : null,
            sourceTitle: "",
            sourceUrl: "",
            areaId: areaList.some((a) => a.id === areaParam) ? areaParam! : null,
            body: "",
            tags: [],
          }}
        />
      </ItemForm>
    </Page>
  );
}
