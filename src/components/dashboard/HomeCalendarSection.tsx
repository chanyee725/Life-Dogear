import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { fetchRange } from "@/components/calendar/model";
import { getCalendar } from "@/lib/calendar";
import { describeError } from "@/lib/storage/describe-error";
import {
  HomeCalendarView,
  HomeDayProvider,
  HomeQuickAdd,
  type HomeCalendarData,
} from "./HomeCalendarDay";

/**
 * Home calendar block, 7:3 like 할 일 → 달력: left the three-week grid (then `children`: the
 * inbox / weekly review lines); right the today panel — the day, `tasks` (오늘 할 일), 다음 일정.
 * 할 일 추가 and 생각 추가 live in the 빠른 추가 popover at the right end of the toolbar.
 * From `lg` the panel is held to the left column's height and scrolls inside. Below `lg`:
 * panel, then grid.
 * The calendar data is not awaited: its promise streams to the client, which draws the grid
 * empty at once and fills it on arrival. So a slow Google feed never holds up the home, and
 * the inputs mount (and hydrate) once — `/`, typing and Enter work while it still loads.
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
  return (
    <HomeDayProvider today={today}>
      <HomeCalendarView
        range="3w"
        syncUrl={false}
        date={today}
        today={today}
        data={loadCalendar(today)}
        now={new Date().toISOString()}
        toolbarEnd={<HomeQuickAdd today={today} />}
        panelSlot={tasks}
        belowGrid={children ? <div className="mt-4 flex flex-col gap-1">{children}</div> : null}
        fitPanel
      />
    </HomeDayProvider>
  );
}

/** Never rejects: an app-data failure comes back as `failed` (the grid says so). */
async function loadCalendar(today: string): Promise<HomeCalendarData> {
  try {
    await e2eDelay();
    const data = await getCalendar(fetchRange("3w", today), { papers: true });
    return { ...data, failed: false };
  } catch (error) {
    console.error("home calendar: app data failed", describeError(error));
    return { items: [], google: "off", failed: true };
  }
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
