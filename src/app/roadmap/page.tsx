import type { Metadata } from "next";
import { firstParam, type QueryParams } from "@/components/list/query";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { buildRoadmap } from "@/lib/repo/roadmap";
import RoadmapTree from "./RoadmapTree";

export const metadata: Metadata = { title: "로드맵" };
export const dynamic = "force-dynamic";

/**
 * 영역 → 목표 → 프로젝트 → 할 일 as one tree. In-progress items only by default;
 * `?all=1` also shows achieved/dropped goals, done projects and done tasks.
 * The 완료 포함 toggle lives in the tree's toolbar.
 */
export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const includeDone = firstParam(await searchParams, "all") === "1";
  const data = await buildRoadmap({ includeDone });

  return (
    <Page>
      <PageHeader title="로드맵" description="영역에서 목표, 프로젝트, 할 일까지 한 번에 봅니다." />
      <RoadmapTree data={data} />
    </Page>
  );
}
