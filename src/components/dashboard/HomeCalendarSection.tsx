import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { fetchRange, weekDays } from "@/components/calendar/model";
import { getCalendar, type CalendarResult } from "@/lib/calendar";
import { describeError } from "@/lib/storage/describe-error";
import { HomeCalendarView, HomeDayProvider, HomeTaskInput } from "./HomeCalendarDay";
import { QuickInput } from "./QuickInput";
import { WeekStripPlaceholder } from "./WeekStripSection";

/**
 * Home calendar block, 7:3 like 할 일 → 달력: left the three-week grid with 생각 추가 under it
 * (then `children`: the inbox / weekly review lines); right the today panel — the day, `tasks`
 * (오늘 할 일), 할 일 추가 (due on the selected day), 다음 일정. From `lg` the panel is held to
 * the left column's height and scrolls inside. Below `lg`: panel, grid, 생각 추가.
 * Streamed so a slow Google feed never holds up the rest of the home; the fallback keeps the
 * tasks and both inputs on screen meanwhile, and their drafts (text, focus, caret) carry over
 * to the loaded copies, so `/` and capture work while the calendar still loads.
 */
export function HomeCalendarSection({
  today,
  tasks,
  children,
}: {
  today: string;
  tasks?: ReactNode;
  children?: ReactNode;
}) {
  const panel = (
    <>
      {tasks}
      <HomeTaskInput today={today} />
    </>
  );
  const below = (
    <div className="mt-4 flex flex-col gap-1">
      <QuickInput />
      {children}
    </div>
  );
  return (
    <HomeDayProvider today={today}>
      <section aria-label="달력">
        <Suspense
          fallback={
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start lg:gap-8">
              <div className="flex min-w-0 flex-col">
                <WeekStripPlaceholder days={weekDays(today)} today={today} />
                {below}
              </div>
              <div className="order-first flex min-w-0 flex-col gap-2 lg:order-none">{panel}</div>
            </div>
          }
        >
          <HomeCalendarData today={today} panel={panel} below={below} />
        </Suspense>
      </section>
    </HomeDayProvider>
  );
}

async function HomeCalendarData({
  today,
  panel,
  below,
}: {
  today: string;
  panel: ReactNode;
  below: ReactNode;
}) {
  await e2eDelay();
  let data: CalendarResult = { items: [], google: "off" };
  let failed = false;
  try {
    data = await getCalendar(fetchRange("3w", today), { papers: true });
  } catch (error) {
    console.error("home calendar: app data failed", describeError(error));
    failed = true;
  }
  return (
    <HomeCalendarView
      range="3w"
      syncUrl={false}
      date={today}
      today={today}
      items={data.items}
      google={data.google}
      failed={failed}
      now={new Date().toISOString()}
      panelSlot={panel}
      belowGrid={below}
      fitPanel
    />
  );
}

/**
 * e2e only (`E2E_HOOKS=1`, set by the Playwright web server): the `e2e-calendar-delay` cookie
 * (ms, ≤ 10 s) holds the calendar back like a slow Google feed, to test the loading state.
 */
async function e2eDelay() {
  if (process.env.E2E_HOOKS !== "1") return;
  const ms = Number((await cookies()).get("e2e-calendar-delay")?.value);
  if (ms > 0) await new Promise((r) => setTimeout(r, Math.min(ms, 10_000)));
}
