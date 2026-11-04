import { Suspense } from "react";
import { CalendarView } from "@/components/calendar/CalendarView";
import { fetchRange, weekDays } from "@/components/calendar/model";
import { getCalendar, type CalendarResult } from "@/lib/calendar";
import { describeError } from "@/lib/storage/describe-error";
import { WeekStripPlaceholder } from "./WeekStripSection";

/**
 * Home calendar: the same 5:5 view as 할 일 → 달력 (two weeks | today panel), streamed so a
 * slow Google feed never holds up the rest of the home. Moving to other weeks opens the full
 * calendar page.
 */
export function HomeCalendarSection({ today }: { today: string }) {
  return (
    <section aria-label="달력">
      <Suspense fallback={<WeekStripPlaceholder days={weekDays(today)} today={today} />}>
        <HomeCalendarData today={today} />
      </Suspense>
    </section>
  );
}

async function HomeCalendarData({ today }: { today: string }) {
  let data: CalendarResult = { items: [], google: "off" };
  let failed = false;
  try {
    data = await getCalendar(fetchRange("2w", today), { papers: true });
  } catch (error) {
    console.error("home calendar: app data failed", describeError(error));
    failed = true;
  }
  return (
    <CalendarView
      range="2w"
      date={today}
      today={today}
      items={data.items}
      google={data.google}
      failed={failed}
      now={new Date().toISOString()}
    />
  );
}
