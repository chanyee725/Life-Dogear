import { ContinueReading } from "@/components/dashboard/ContinueReading";
import { ActiveProjects } from "@/components/dashboard/ActiveProjects";
import { InboxLine } from "@/components/dashboard/InboxLine";
import { QuickInput } from "@/components/dashboard/QuickInput";
import { RecentSeminars, RecentThoughts } from "@/components/dashboard/RecentLists";
import { Page } from "@/components/shell";
import { papers, projects, seminars, thoughts } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Repo defaults leave archived items out of every list here.
  const [reading, stages, general, inboxCount, recentThoughts, recentSeminars] = await Promise.all([
    papers.listContinueReading(6),
    projects.listByStage(),
    projects.listActiveGeneral(),
    thoughts.countInbox(),
    thoughts.listRecent(5),
    seminars.listRecent(5),
  ]);

  return (
    <Page className="flex flex-col gap-10">
      <h1 className="sr-only">홈</h1>
      <div className="flex flex-col gap-1">
        <QuickInput />
        <InboxLine count={inboxCount} />
      </div>
      <ContinueReading papers={reading} />
      <ActiveProjects stages={stages} general={general} />
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <RecentThoughts thoughts={recentThoughts} />
        <RecentSeminars seminars={recentSeminars} />
      </div>
    </Page>
  );
}
