import type { Metadata } from "next";
import { createArea } from "@/app/_actions/areas";
import { ItemForm } from "@/components/fields/ItemForm";
import { Page } from "@/components/shell/PageHeader";
import { tags } from "@/lib/repo";
import { AreaFields } from "../AreaFields";

export const metadata: Metadata = { title: "새 영역" };
export const dynamic = "force-dynamic";

export default async function NewAreaPage() {
  const allTags = await tags.listAll({ visibleOnly: true });
  return (
    <Page>
      <ItemForm mode="create" action={createArea} basePath="/areas" backLabel="영역">
        <AreaFields
          editorKey="new"
          tagSuggestions={allTags.map((t) => t.name)}
          values={{ title: "", standard: "", body: "", tags: [] }}
        />
      </ItemForm>
    </Page>
  );
}
