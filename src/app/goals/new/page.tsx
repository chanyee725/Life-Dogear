import type { Metadata } from "next";
import { ItemForm } from "@/components/fields/ItemForm";
import { firstParam, type QueryParams } from "@/components/list/query";
import { Page } from "@/components/shell/PageHeader";
import { GOAL_HORIZON } from "@/lib/enums";
import { areas, goals, tags } from "@/lib/repo";
import { currentPeriod } from "@/lib/repo/goals";
import { areaOptionsFor } from "../../projects/ProjectFields";
import { createGoal } from "../actions";
import { GoalFields } from "../GoalFields";
import { initialAreaId, parentOptionsFor } from "../options";

export const metadata: Metadata = { title: "새 목표" };
export const dynamic = "force-dynamic";

/**
 * `?horizon=life|year|quarter` picks the level; `?parent=<id>` preselects the parent;
 * `?area=<id>` preselects the area (ignored unless it is a non-archived area).
 */
export default async function NewGoalPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const [allTags, areaList, goalList] = await Promise.all([
    tags.listAll({ visibleOnly: true }),
    areas.list(),
    goals.list(),
  ]);
  const parent = goalList.find((g) => g.id === firstParam(params, "parent"));
  const horizonParam = firstParam(params, "horizon");
  const horizon = GOAL_HORIZON.is(horizonParam)
    ? horizonParam
    : parent?.horizon === "life"
      ? "year"
      : "quarter";
  const fitsParent =
    parent &&
    ((horizon === "year" && parent.horizon === "life") ||
      (horizon === "quarter" && parent.horizon === "year"));
  // Default period: the parent year for a quarter goal, else now.
  const period =
    horizon === "quarter" && fitsParent && parent.period
      ? `${parent.period}-Q1`
      : currentPeriod(horizon);

  return (
    <Page>
      <ItemForm mode="create" action={createGoal} basePath="/goals" backLabel="목표">
        <GoalFields
          editorKey="new"
          tagSuggestions={allTags.map((t) => t.name)}
          parentOptions={parentOptionsFor(goalList, null, null)}
          areaOptions={areaOptionsFor(areaList, null)}
          values={{
            title: "",
            horizon,
            period,
            parentId: fitsParent ? parent.id : null,
            areaId: initialAreaId(firstParam(params, "area"), areaList, parent?.areaId),
            why: "",
            status: "active",
            progressMode: "auto",
            manualProgress: null,
            body: "",
            tags: [],
          }}
        />
      </ItemForm>
    </Page>
  );
}
