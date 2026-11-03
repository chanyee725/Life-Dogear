import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { areas, projects } from "@/lib/repo";
import { AreaOrderList } from "./AreaOrderList";

export const metadata: Metadata = { title: "영역" };
export const dynamic = "force-dynamic";

export default async function AreasPage() {
  // Counted like the area page: own projects plus area-less ones toward its goals.
  const [areaList, counts] = await Promise.all([areas.list(), projects.countByArea()]);

  return (
    <Page>
      <PageHeader
        title="영역"
        description="끝나지 않고 꾸준히 돌봐야 하는 책임. 순서는 사이드바에도 그대로 쓰입니다."
        actions={
          <Link href="/areas/new" className={buttonClass("primary")}>
            새 영역
          </Link>
        }
      />
      {areaList.length === 0 ? (
        <EmptyState
          title="아직 영역이 없습니다"
          description="사이드바에서 추천 영역을 골라 만들거나 새 영역을 추가하세요."
          action={
            <Link href="/areas/new" className={buttonClass("primary", "sm")}>
              새 영역
            </Link>
          }
        />
      ) : (
        <AreaOrderList
          // Remount after a server refresh so the order matches the database.
          key={areaList.map((a) => a.id).join(",")}
          areas={areaList.map((a) => ({
            id: a.id,
            title: a.title,
            standard: a.standard,
            projectCount: counts.get(a.id) ?? 0,
          }))}
        />
      )}
    </Page>
  );
}
