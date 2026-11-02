import { ContinueReading } from "@/components/dashboard/ContinueReading";
import { ProjectKanban } from "@/components/dashboard/ProjectKanban";
import { QuickInput } from "@/components/dashboard/QuickInput";
import { RecentSeminars, RecentThoughts } from "@/components/dashboard/RecentLists";
import { Page } from "@/components/shell";
import { papers, projects, seminars, thoughts } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [reading, stages, recentThoughts, recentSeminars] = await Promise.all([
    papers.listContinueReading(6),
    projects.listByStage(),
    thoughts.listRecent(5),
    seminars.listRecent(5),
  ]);

  return (
    <Page className="flex flex-col gap-10">
      <h1 className="sr-only">홈</h1>
      <QuickInput />
      <ContinueReading papers={reading} />
      <ProjectKanban columns={stages} />
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <RecentThoughts thoughts={recentThoughts} />
        <RecentSeminars seminars={recentSeminars} />
      </div>
    </Page>
  );
}
