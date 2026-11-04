import type { Metadata } from "next";
import { ItemForm } from "@/components/fields/ItemForm";
import { firstParam, type QueryParams } from "@/components/list/query";
import { Page } from "@/components/shell/PageHeader";
import { PROJECT_KIND } from "@/lib/enums";
import { areas, goals, tags } from "@/lib/repo";
import { goalOptionsFor } from "../../goals/options";
import { createProject } from "../actions";
import { areaOptionsFor } from "../ProjectFields";
import { NewProjectFields } from "./NewProjectFields";

export const metadata: Metadata = { title: "새 프로젝트" };
export const dynamic = "force-dynamic";

/**
 * `?kind=general` starts a general project (template 일반 프로젝트, otherwise 연구(논문));
 * `?area=<id>` / `?goal=<id>` preselect the area or goal. The template picker fills the body.
 */
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const kindParam = firstParam(params, "kind");
  const kind = PROJECT_KIND.is(kindParam) ? kindParam : "research";
  const [allTags, areaList, goalList] = await Promise.all([
    tags.listAll({ visibleOnly: true }),
    areas.list(),
    goals.list(),
  ]);
  const goalParam = firstParam(params, "goal");
  const goal = goalList.find((g) => g.id === goalParam);
  const areaParam = firstParam(params, "area");
  // A goal's area carries over unless an area is asked for.
  const areaId = areaList.some((a) => a.id === areaParam) ? areaParam! : (goal?.areaId ?? null);

  return (
    <Page>
      <ItemForm mode="create" action={createProject} basePath="/projects" backLabel="프로젝트">
        <NewProjectFields
          tagSuggestions={allTags.map((t) => t.name)}
          areaOptions={areaOptionsFor(areaList, null)}
          goalOptions={goalOptionsFor(goalList, null)}
          values={{
            title: "",
            kind,
            stage: "exploring",
            status: "active",
            areaId,
            goalId: goal?.id ?? null,
            nextAction: "",
            researchQuestion: "",
            startDate: null,
            dueDate: null,
            tags: [],
          }}
        />
      </ItemForm>
    </Page>
  );
}
