import type { Metadata } from "next";
import { ItemForm } from "@/components/fields/ItemForm";
import { firstParam, type QueryParams } from "@/components/list/query";
import { Page } from "@/components/shell/PageHeader";
import { PROJECT_KIND } from "@/lib/enums";
import { areas, tags } from "@/lib/repo";
import { TEMPLATES } from "@/lib/templates";
import { createProject } from "../actions";
import { areaOptionsFor, ProjectFields } from "../ProjectFields";

export const metadata: Metadata = { title: "새 프로젝트" };
export const dynamic = "force-dynamic";

/** `?kind=general` starts a general project; `?area=<id>` preselects the area. */
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const kindParam = firstParam(params, "kind");
  const kind = PROJECT_KIND.is(kindParam) ? kindParam : "research";
  const [allTags, areaList] = await Promise.all([
    tags.listAll({ visibleOnly: true }),
    areas.list(),
  ]);
  const areaParam = firstParam(params, "area");
  const areaId = areaList.some((a) => a.id === areaParam) ? areaParam! : null;

  return (
    <Page>
      <ItemForm mode="create" action={createProject} basePath="/projects" backLabel="프로젝트">
        <ProjectFields
          editorKey="new"
          tagSuggestions={allTags.map((t) => t.name)}
          areaOptions={areaOptionsFor(areaList, null)}
          values={{
            title: "",
            kind,
            stage: "exploring",
            status: "active",
            areaId,
            nextAction: "",
            researchQuestion: "",
            startDate: null,
            dueDate: null,
            // The research template (proposal, chapters…) doesn't fit general projects.
            body: kind === "research" ? TEMPLATES.project : "",
            tags: [],
          }}
        />
      </ItemForm>
    </Page>
  );
}
