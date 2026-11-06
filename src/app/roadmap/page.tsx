import type { Metadata } from "next";
import Link from "next/link";
import { firstParam, type QueryParams } from "@/components/list/query";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { buildRoadmap } from "@/lib/repo/roadmap";
import { cn } from "@/components/ui/cn";
import RoadmapTree from "./RoadmapTree";

export const metadata: Metadata = { title: "로드맵" };
export const dynamic = "force-dynamic";

/**
 * 영역 → 목표 → 프로젝트 → 할 일 as one tree. In-progress items only by default;
 * `?done=1` also shows achieved/dropped goals, done projects and done tasks.
 */
export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const includeDone = firstParam(await searchParams, "done") === "1";
  const data = await buildRoadmap({ includeDone });

  return (
    <Page>
      <PageHeader
        title="로드맵"
        description="영역에서 목표, 프로젝트, 할 일까지 한 번에 봅니다."
        actions={
          <Link
            href={includeDone ? "/roadmap" : "/roadmap?done=1"}
            role="switch"
            aria-checked={includeDone}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-muted hover:bg-hover hover:text-fg"
          >
            <span
              aria-hidden
              className={cn(
                "relative inline-block h-4 w-7 rounded-full transition-colors",
                includeDone ? "bg-accent" : "bg-border",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-3 rounded-full bg-white transition-all",
                  includeDone ? "left-3.5" : "left-0.5",
                )}
              />
            </span>
            완료 포함
          </Link>
        }
      />
      <RoadmapTree data={data} />
    </Page>
  );
}
