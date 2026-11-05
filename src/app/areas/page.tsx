import type { Metadata } from "next";
import { firstParam, type QueryParams } from "@/components/list/query";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { EmptyAdd } from "@/components/ui";
import { areas } from "@/lib/repo";
import { AreasView } from "./AreasView";
import { parseAreaSort } from "./list";

export const metadata: Metadata = { title: "영역" };
export const dynamic = "force-dynamic";

export default async function AreasPage({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const params = await searchParams;
  const [areaList, care] = await Promise.all([areas.list(), areas.listCare()]);

  if (areaList.length === 0) {
    return (
      <Page>
        <PageHeader title="영역" />
        <EmptyAdd compact href="/areas/new">
          ＋ 새 영역
        </EmptyAdd>
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
