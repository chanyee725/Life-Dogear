import type { Metadata } from "next";
import { EmptyState, LinkTabs, NewItemButton } from "@/components/ui";
import { seoulDate } from "@/components/calendar/model";
import { buildHref, firstParam, type QueryParams } from "@/components/list/query";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { areas, goals } from "@/lib/repo";
import { GoalDirection } from "./GoalDirection";
import {
  GoalList,
  type AreaChoice,
  type PeriodChoice,
  type PeriodKey,
  type YearChoice,
} from "./GoalList";
import { GoalMap } from "./GoalMap";
import {
  areasWithGoals,
  buildGoalList,
  hasGoalsWithoutArea,
  NO_AREA,
  NO_AREA_TITLE,
  otherYears,
  parsePeriodFilter,
  periodParam,
  type PeriodFilter,
} from "./list-view";

export const metadata: Metadata = { title: "목표" };
export const dynamic = "force-dynamic";

/**
 * `?view=map` shows the 목표 지도 (goals → projects → linked material) as text.
 * The list view takes `?period=quarter|year|<연도>|all` (default this quarter) and
 * `?area=<id>|none`; the text filter lives in the page.
 */
export default async function GoalsPage({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const params = await searchParams;
  const view = firstParam(params, "view") === "map" ? "map" : "tree";
  const tree = await goals.listTree();

  return (
    <Page>
      <PageHeader
        title="목표"
        actions={
          <NewItemButton href="/goals/new" shortcut={false}>
            새 목표
          </NewItemButton>
        }
      />
      <LinkTabs
        ariaLabel="목표 보기"
        active={view}
        className="mb-5"
        tabs={[
          { value: "tree", label: "목표", href: "/goals" },
          { value: "map", label: "목표 지도", href: "/goals?view=map" },
        ]}
      />
      {tree.length === 0 ? (
        <EmptyState
          title="아직 목표가 없습니다"
          action={
            <NewItemButton href="/goals/new?horizon=life" size="sm">
              인생 목표 만들기
            </NewItemButton>
          }
        />
      ) : view === "map" ? (
        <GoalMap nodes={tree} />
      ) : (
        <GoalListView tree={tree} params={params} />
      )}
    </Page>
  );
}

async function GoalListView({
  tree,
  params,
}: {
  tree: Awaited<ReturnType<typeof goals.listTree>>;
  params: QueryParams;
}) {
  const now = new Date();
  // Archived areas too, so their goals still group under their name.
  const areaList = (await areas.list({ includeArchived: true })).map((a) => ({
    id: a.id,
    title: a.title,
  }));
  const everything = buildGoalList(tree, areaList, { period: { kind: "all" } });
  const choosable = areasWithGoals(everything, areaList);

  const period = parsePeriodFilter(firstParam(params, "period"), now);
  const areaParam = firstParam(params, "area");
  const areaId =
    areaParam === NO_AREA || choosable.some((a) => a.id === areaParam) ? areaParam : undefined;
  const areaTitle =
    areaId === NO_AREA ? NO_AREA_TITLE : choosable.find((a) => a.id === areaId)?.title;
  const { direction, groups, ended } = buildGoalList(tree, areaList, { period, areaId });

  const listParams = { period: periodParam(period), area: areaId };
  const periodHref = (p: PeriodFilter) =>
    buildHref("/goals", listParams, { period: periodParam(p) });
  const periodChoices: PeriodChoice[] = [
    { value: "quarter", label: "이번 분기", href: periodHref(parsePeriodFilter(undefined, now)) },
    { value: "year", label: "올해", href: periodHref(parsePeriodFilter("year", now)) },
    { value: "all", label: "전체", href: periodHref({ kind: "all" }) },
  ];
  // Another year (`?period=2027`) checks none of the three; the year select shows it.
  const otherYear = period.kind === "year" && !period.current ? period.year : null;
  const periodValue: PeriodKey | null = otherYear ? null : period.kind;
  const yearChoices: YearChoice[] = otherYears(tree, now, otherYear).map((year) => ({
    value: year,
    href: periodHref({ kind: "year", year, current: false }),
  }));

  const areaHref = (value: string | undefined) => buildHref("/goals", listParams, { area: value });
  const areaChoices: AreaChoice[] = [
    { value: "", label: "모든 영역", href: areaHref(undefined) },
    ...choosable.map((a) => ({ value: a.id, label: a.title, href: areaHref(a.id) })),
    ...(hasGoalsWithoutArea(everything)
      ? [{ value: NO_AREA, label: NO_AREA_TITLE, href: areaHref(NO_AREA) }]
      : []),
  ];

  return (
    <>
      <GoalDirection goals={direction} />
      <GoalList
        groups={groups}
        ended={ended}
        periodChoices={periodChoices}
        periodValue={periodValue}
        yearChoices={yearChoices}
        selectedYear={otherYear ?? ""}
        areaChoices={areaChoices}
        selectedArea={areaId ?? ""}
        areaTitles={Object.fromEntries(areaList.map((a) => [a.id, a.title]))}
        today={seoulDate(now)}
        period={period}
        areaTitle={areaTitle}
        resetHref="/goals?period=all"
      />
    </>
  );
}
