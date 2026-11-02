import type { Metadata } from "next";
import { ItemForm } from "@/components/fields/ItemForm";
import { Page } from "@/components/shell/PageHeader";
import { tags } from "@/lib/repo";
import { TEMPLATES } from "@/lib/templates";
import { createThought } from "../actions";
import { ThoughtFields } from "../ThoughtFields";

export const metadata: Metadata = { title: "새 생각" };
export const dynamic = "force-dynamic";

export default async function NewThoughtPage() {
  const allTags = await tags.listAll();
  return (
    <Page>
      <ItemForm mode="create" action={createThought} basePath="/thoughts" backLabel="생각">
        <ThoughtFields
          editorKey="new"
          tagSuggestions={allTags.map((t) => t.name)}
          values={{ title: "", kind: "idea", maturity: "seed", body: TEMPLATES.thought, tags: [] }}
        />
      </ItemForm>
    </Page>
  );
}
