import type { Metadata } from "next";
import { firstParam, type QueryParams } from "@/components/list/query";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { getRoadmapTree, listRoadmaps } from "@/lib/repo/learningRoadmap";
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, STATUSES, ratio } from "./model";
import RoadmapEmpty from "./RoadmapEmpty";
import RoadmapPicker from "./RoadmapPicker";
import RoadmapView from "./RoadmapView";
import "./roadmap.css";

export const metadata: Metadata = { title: "로드맵" };
export const dynamic = "force-dynamic";

function Legend() {
  return (
    <ul className="rm-legend flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" aria-label="범례">
      {PRIORITIES.map((p) => (
        <li key={p} className="rm-legend-item flex items-center gap-1.5" data-priority={p}>
          {PRIORITY_LABEL[p]}
        </li>
      ))}
      {STATUSES.map((s) => (
        <li key={s} className="rm-legend-item flex items-center gap-1.5" data-status={s}>
          {STATUS_LABEL[s]}
        </li>
      ))}
    </ul>
  );
}

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
        {roadmap && (
          <>
            <div className="rm-head flex flex-col gap-2">
              <h2 className="rm-title text-xl font-semibold">{roadmap.title}</h2>
              {roadmap.summary && <p className="rm-desc text-sm">{roadmap.summary}</p>}
              <div
                className="rm-progress flex max-w-sm items-center gap-2"
                role="progressbar"
                aria-label="전체 진행률"
                aria-valuemin={0}
                aria-valuemax={roadmap.progress.total}
                aria-valuenow={roadmap.progress.done}
                style={{ "--rm-progress": ratio(roadmap.progress) } as React.CSSProperties}
              >
                <span className="rm-progress-bar block h-1.5 flex-1" />
                <span className="rm-progress-text text-xs tabular-nums">
                  {roadmap.progress.done}/{roadmap.progress.total}
                </span>
              </div>
              <Legend />
            </div>
            <RoadmapView key={roadmap.id} roadmap={roadmap} />
          </>
        )}
      </div>
    </Page>
  );
}
