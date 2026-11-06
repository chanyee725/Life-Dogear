import type { Metadata } from "next";
import { firstParam, type QueryParams } from "@/components/list/query";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { getRoadmapTree, listRoadmaps } from "@/lib/repo/learningRoadmap";
import RoadmapEmpty from "./RoadmapEmpty";
import RoadmapPicker from "./RoadmapPicker";
import RoadmapView from "./RoadmapView";
import "./roadmap.css";

export const metadata: Metadata = { title: "로드맵" };
export const dynamic = "force-dynamic";

/** Learning roadmaps imported from Claude Code JSON (`npm run roadmap:import`); `?r=slug` picks one. */
export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const roadmaps = await listRoadmaps();
  if (roadmaps.length === 0) {
    return (
      <Page className="rm-root">
        <PageHeader title="로드맵" />
        <RoadmapEmpty />
      </Page>
    );
  }
  const wanted = firstParam(await searchParams, "r");
  const slug = roadmaps.some((r) => r.slug === wanted) ? wanted! : roadmaps[0].slug;
  const roadmap = await getRoadmapTree(slug);

  return (
    <Page className="rm-root max-w-[96rem]">
      <PageHeader title="로드맵" />
      <div className="flex flex-col gap-5">
        <RoadmapPicker roadmaps={roadmaps} current={slug} />
        {roadmap && <RoadmapView key={roadmap.id} roadmap={roadmap} />}
      </div>
    </Page>
  );
}
