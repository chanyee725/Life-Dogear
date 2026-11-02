import type { Metadata } from "next";
import Link from "next/link";
import { LinkTabs } from "@/components/list/Tabs";
import { firstParam, type QueryParams } from "@/components/list/query";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { goals } from "@/lib/repo";
import { GoalMap } from "./GoalMap";
import { GoalTree } from "./GoalTree";

export const metadata: Metadata = { title: "목표" };
export const dynamic = "force-dynamic";

/** `?view=map` shows the 목표 지도 (goals → projects → linked material) as text. */
export default async function GoalsPage({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const view = firstParam(await searchParams, "view") === "map" ? "map" : "tree";
  const tree = await goals.listTree();

  return (
    <Page>
      <PageHeader
        title="목표"
        description="인생 목표 아래에 연·분기 목표를 두고, 프로젝트가 목표를 향하게 합니다."
        actions={
          <Link href="/goals/new" className={buttonClass("primary")}>
            새 목표
          </Link>
        }
      />
      <LinkTabs
        ariaLabel="목표 보기"
        active={view}
        className="mb-6"
        tabs={[
          { value: "tree", label: "목표", href: "/goals" },
          { value: "map", label: "목표 지도", href: "/goals?view=map" },
        ]}
      />
      {tree.length === 0 ? (
        <EmptyState
          title="아직 목표가 없습니다"
          description="방향이 되는 인생 목표부터 하나 세워 보세요."
          action={
            <Link href="/goals/new?horizon=life" className={buttonClass("primary", "sm")}>
              인생 목표 만들기
            </Link>
          }
        />
      ) : view === "map" ? (
        <GoalMap nodes={tree} />
      ) : (
        <GoalTree nodes={tree} />
      )}
    </Page>
  );
}
