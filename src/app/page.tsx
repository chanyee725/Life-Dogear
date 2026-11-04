import { ActiveGeneralProjects, ActiveResearch } from "@/components/dashboard/ActiveProjects";
import { ContinueReading } from "@/components/dashboard/ContinueReading";
import { InboxLine } from "@/components/dashboard/InboxLine";
import { QuarterGoals } from "@/components/dashboard/QuarterGoals";
import { QuickInput } from "@/components/dashboard/QuickInput";
import { RecentSeminars, RecentThoughts } from "@/components/dashboard/RecentLists";
import { RevisitStars } from "@/components/dashboard/RevisitStars";
import {
  quarterGoal,
  quarterGoalNodes,
  restOfWeek,
  revisitStars,
  seoulToday,
  todayHeading,
} from "@/components/dashboard/today";
import { TodayTasks, WeekTasks } from "@/components/dashboard/TodayTasks";
import { WeekStripSection } from "@/components/dashboard/WeekStripSection";
import { WeeklyReviewLine } from "@/components/dashboard/WeeklyReviewLine";
import { Page } from "@/components/shell";
import { getCosmosScores } from "@/lib/cosmos/load";
import { goals, papers, projects, seminars, tasks, thoughts } from "@/lib/repo";
import * as reviews from "@/lib/repo/reviews";
import { periodOf, weeklyReviewDue } from "@/lib/reviews/period";

export const dynamic = "force-dynamic";

/**
 * Home = 오늘 화면 (docs/design/today.md 4절). Fixed query count: one batch in parallel,
 * then one task count for this quarter's goals.
 */
export default async function HomePage() {
  const now = new Date();
  // Seoul day, not the server's zone; `day` feeds the Date-based review helpers.
  const { today, day } = seoulToday(now);
  const week = restOfWeek(today);
  const dueWeek = weeklyReviewDue(day);
  // Repo defaults leave archived items out of every list here.
  const [
    reading,
    stages,
    general,
    inboxCount,
    recentThoughts,
    recentSeminars,
    dueWritten,
    todayTasks,
    weekTasks,
    goalTree,
    cosmos,
  ] = await Promise.all([
    papers.listContinueReading(6),
    projects.listByStage(),
    projects.listActiveGeneral(),
    thoughts.countInbox(),
    thoughts.listRecent(5),
    seminars.listRecent(5),
    dueWeek ? reviews.existingPeriods("week", [dueWeek]) : Promise.resolve(new Set<string>()),
    tasks.listToday(today),
    week ? tasks.listThisWeek(week.from, week.to) : Promise.resolve([]),
    goals.listTree(),
    getCosmosScores({}, now),
  ]);
  const reviewDue = dueWeek && !dueWritten.has(dueWeek) ? dueWeek : null;
  const goalNodes = quarterGoalNodes(goalTree, periodOf("quarter", day));
  const goalTasks = goalNodes.length
    ? await tasks.countFor(goalNodes.map((n) => ({ type: "goal" as const, id: n.goal.id })))
    : {};
  const quarter = goalNodes.map((n) => quarterGoal(n, goalTasks[`goal:${n.goal.id}`]));
  const stars = revisitStars(cosmos, now);

  return (
    <Page className="flex flex-col gap-10">
      <h1 className="text-base font-semibold tracking-tight">{todayHeading(today)}</h1>
      <div className="flex flex-col gap-1">
        <QuickInput />
        <InboxLine count={inboxCount} />
        <WeeklyReviewLine period={reviewDue} today={day} />
      </div>
      <WeekStripSection today={today} />
      <TodayTasks overdue={todayTasks.overdue} dueToday={todayTasks.today} today={today} />
      <WeekTasks tasks={weekTasks} today={today} />
      {quarter.length || stars.length ? (
        // Two columns only when both have something (today.md 4.1).
        <div
          className={
            quarter.length && stars.length ? "grid grid-cols-1 gap-10 md:grid-cols-2" : "contents"
          }
        >
          <QuarterGoals goals={quarter} />
          <RevisitStars stars={stars} now={now} />
        </div>
      ) : null}
      <ContinueReading papers={reading} />
      <ActiveResearch stages={stages} />
      <ActiveGeneralProjects projects={general} />
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <RecentThoughts thoughts={recentThoughts} />
        <RecentSeminars seminars={recentSeminars} />
      </div>
    </Page>
  );
}
