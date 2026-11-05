import { ActiveGeneralProjects, ActiveResearch } from "@/components/dashboard/ActiveProjects";
import { ContinueReading } from "@/components/dashboard/ContinueReading";
import { InboxLine } from "@/components/dashboard/InboxLine";
import { QuarterGoals } from "@/components/dashboard/QuarterGoals";
import { RecentSeminars, RecentThoughts } from "@/components/dashboard/RecentLists";
import { RevisitStars } from "@/components/dashboard/RevisitStars";
import {
  projectContext,
  projectProgress,
  quarterGoal,
  quarterGoalNodes,
  restOfWeek,
  revisitStars,
  seoulToday,
} from "@/components/dashboard/today";
import { HomeTodo } from "@/components/dashboard/HomeTodo";
import { TodayTasks, UpcomingTasks, WeekTasks } from "@/components/dashboard/TodayTasks";
import { HomeCalendarSection } from "@/components/dashboard/HomeCalendarSection";
import { WeeklyReviewLine } from "@/components/dashboard/WeeklyReviewLine";
import { Page } from "@/components/shell";
import { getCosmosScores } from "@/lib/cosmos/load";
import { areas, goals, papers, projects, seminars, tasks, thoughts } from "@/lib/repo";
import * as reviews from "@/lib/repo/reviews";
import { periodOf, weeklyReviewDue } from "@/lib/reviews/period";

export const dynamic = "force-dynamic";

/**
 * Home = 오늘 화면 (docs/design/today.md 4절). Fixed query count: one batch in parallel,
 * then task counts for this quarter's goals and for the general projects (one each).
 * Project cards' goal titles come from the goal tree; area titles from one area list.
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
    areaList,
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
    areas.list(),
  ]);
  const reviewDue = dueWeek && !dueWritten.has(dueWeek) ? dueWeek : null;
  const goalNodes = quarterGoalNodes(goalTree, periodOf("quarter", day));
  type Counts = Record<string, { done: number; total: number }>;
  const [goalTasks, projectTasks] = await Promise.all([
    goalNodes.length
      ? tasks.countFor(goalNodes.map((n) => ({ type: "goal" as const, id: n.goal.id })))
      : ({} as Counts),
    general.length
      ? tasks.countFor(general.map((p) => ({ type: "project" as const, id: p.id })))
      : ({} as Counts),
  ]);
  const generalProgress = projectProgress(
    general.map((p) => p.id),
    projectTasks,
  );
  const generalContext = projectContext(general, goalTree, areaList);
  const quarter = goalNodes.map((n) => quarterGoal(n, goalTasks[`goal:${n.goal.id}`]));
  const stars = revisitStars(cosmos, now);

  return (
    <Page className="flex max-w-6xl flex-col gap-8">
      {/* No date heading: the today panel already shows the day large. */}
      <h1 className="sr-only">홈</h1>
      <HomeCalendarSection
        today={today}
        todo={
          <HomeTodo
            count={todayTasks.overdue.length + todayTasks.today.length}
            today={
              <TodayTasks
                overdue={todayTasks.overdue}
                dueToday={todayTasks.today}
                done={todayTasks.done}
                today={today}
              />
            }
            upcoming={<UpcomingTasks tasks={weekTasks} today={today} />}
          />
        }
      >
        <InboxLine count={inboxCount} />
        <WeeklyReviewLine period={reviewDue} today={day} />
      </HomeCalendarSection>
      <WeekTasks tasks={weekTasks} today={today} />
      {quarter.length || stars.length ? (
        // Two columns only when both have something (today.md 4.1).
        <div
          className={
            quarter.length && stars.length ? "grid grid-cols-1 gap-8 md:grid-cols-2" : "contents"
          }
        >
          <QuarterGoals goals={quarter} />
          <RevisitStars stars={stars} now={now} />
        </div>
      ) : null}
      <ContinueReading papers={reading} />
      <ActiveResearch stages={stages} />
      <ActiveGeneralProjects
        projects={general}
        today={today}
        progress={generalProgress}
        context={generalContext}
      />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <RecentThoughts thoughts={recentThoughts} />
        <RecentSeminars seminars={recentSeminars} />
      </div>
    </Page>
  );
}
