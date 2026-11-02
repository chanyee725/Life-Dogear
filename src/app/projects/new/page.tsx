import type { Metadata } from "next";
import { ItemForm } from "@/components/fields/ItemForm";
import { Page } from "@/components/shell/PageHeader";
import { tags } from "@/lib/repo";
import { TEMPLATES } from "@/lib/templates";
import { createProject } from "../actions";
import { ProjectFields } from "../ProjectFields";

export const metadata: Metadata = { title: "새 연구" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const allTags = await tags.listAll();
  return (
    <Page>
      <ItemForm mode="create" action={createProject} basePath="/projects" backLabel="연구">
        <ProjectFields
          editorKey="new"
          tagSuggestions={allTags.map((t) => t.name)}
          values={{
            title: "",
            researchQuestion: "",
            stage: "exploring",
            startDate: null,
            dueDate: null,
            body: TEMPLATES.project,
            tags: [],
          }}
        />
      </ItemForm>
    </Page>
  );
}
