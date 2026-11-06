import type { Metadata } from "next";
import { ItemForm } from "@/components/fields/ItemForm";
import { Page } from "@/components/shell/PageHeader";
import { tags } from "@/lib/repo";
import { TEMPLATES } from "@/lib/templates";
import { createSeminar } from "../actions";
import { SeminarFields } from "../SeminarFields";

export const metadata: Metadata = { title: "새 활동" };
export const dynamic = "force-dynamic";

export default async function NewSeminarPage() {
  const allTags = await tags.listAll();
  return (
    <Page>
      <ItemForm mode="create" action={createSeminar} basePath="/seminars" backLabel="활동">
        <SeminarFields
          editorKey="new"
          tagSuggestions={allTags.map((t) => t.name)}
          values={{
            title: "",
            date: null,
            speaker: "",
            hostVenue: "",
            kind: "seminar",
            keyLine: "",
            materialUrl: "",
            body: TEMPLATES.seminar,
            tags: [],
          }}
        />
      </ItemForm>
    </Page>
  );
}
