import { Suspense, type ReactNode } from "react";
import { fetchRange, weekDays } from "@/components/calendar/model";
import { getCalendar, type CalendarResult } from "@/lib/calendar";
import { describeError } from "@/lib/storage/describe-error";
import { HomeCalendarView, HomeDayProvider, HomeInputs } from "./HomeCalendarDay";
import { WeekStripPlaceholder } from "./WeekStripSection";

/**
 * Home calendar: the same 5:5 view as 할 일 → 달력 (three weeks | today panel), streamed so a
 * slow Google feed never holds up the rest of the home. Moving to other weeks opens the full
 * calendar page. Under it, full width: 할 일 추가 (due on the selected day) | 생각 추가 —
 * outside the Suspense so `/` and capture work while the calendar still loads — then
 * `children` (the inbox / weekly review lines).
 */
export function HomeCalendarSection({ today, children }: { today: string; children?: ReactNode }) {
  return (
    <HomeDayProvider today={today}>
      <section aria-label="달력" className="flex flex-col gap-4">
        <Suspense fallback={<WeekStripPlaceholder days={weekDays(today)} today={today} />}>
          <HomeCalendarData today={today} />
        </Suspense>
        <div className="flex flex-col gap-1">
          <HomeInputs today={today} />
          {children}
        </div>
      </section>
    </HomeDayProvider>
  );
}

async function HomeCalendarData({ today }: { today: string }) {
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
    />
  );
}
