import type { Metadata } from "next";
import Link from "next/link";
import { firstParam, type QueryParams } from "@/components/list/query";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
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
        <PageHeader title="영역" description="끝나지 않고 꾸준히 돌봐야 하는 책임." />
        <EmptyState
          title="아직 영역이 없습니다"
          description="건강·학위처럼 꾸준히 챙길 일을 영역으로 만들어 두면 프로젝트와 목표를 그 아래에 모을 수 있습니다. 사이드바의 추천 영역에서 고르거나 새 영역을 추가하세요."
          action={
            <Link href="/areas/new" className={buttonClass("primary", "sm")}>
              새 영역
            </Link>
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
            pinned: a.pinnedAt !== null,
          };
        })}
      />
    </Page>
  );
}
