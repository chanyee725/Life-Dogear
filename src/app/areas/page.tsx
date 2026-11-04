import type { Metadata } from "next";
import { firstParam, type QueryParams } from "@/components/list/query";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { areas } from "@/lib/repo";
import { AreasView } from "./AreasView";
import { parseAreaSort } from "./list";
import { NewItemButton } from "@/components/ui";

export const metadata: Metadata = { title: "영역" };
export const dynamic = "force-dynamic";

export default async function AreasPage({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const params = await searchParams;
  const [areaList, care] = await Promise.all([areas.list(), areas.listCare()]);

  if (areaList.length === 0) {
    return (
      <Page>
        <PageHeader title="영역" />
        <EmptyState
          title="아직 영역이 없습니다"
          action={
            <NewItemButton href="/areas/new" size="sm">
              새 영역
            </NewItemButton>
          }
        />
      </Page>
    );
  }

  return (
    <Page>
      <AreasView
        sort={parseAreaSort(firstParam(params, "sort"))}
        initialQuery={firstParam(params, "q") ?? ""}
        now={new Date().toISOString()}
        areas={areaList.map((a) => {
          const c = care.get(a.id);
          return {
            id: a.id,
            title: a.title,
            standard: a.standard,
            lastActivity: c?.lastActivity ?? a.updatedAt,
            openProjects: c?.openProjects ?? 0,
            activeGoals: c?.activeGoals ?? 0,
            openTasks: c?.openTasks ?? 0,
          };
        })}
      />
    </Page>
  );
}
