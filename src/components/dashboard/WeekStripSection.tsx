import { Suspense } from "react";
import { WEEKDAYS, weekDays } from "@/components/calendar/model";
import { getCalendar, type CalendarResult } from "@/lib/calendar";
import { WeekStrip } from "./WeekStrip";

/**
 * Home 7-day strip, streamed: Google can take seconds, so the rest of the home renders
 * first and a quiet placeholder (the seven days, no dots, no links) holds the place.
 */
export function WeekStripSection({ today }: { today: string }) {
  const days = weekDays(today);
  return (
    <Suspense fallback={<WeekStripPlaceholder days={days} today={today} />}>
      <WeekStripData days={days} today={today} />
    </Suspense>
  );
}

async function WeekStripData({ days, today }: { days: string[]; today: string }) {
  // Papers always come along; the strip filters by the "표시" choice. A failure only
  // empties the strip.
  const data = await getCalendar({ from: days[0]!, to: days[6]! }, { papers: true }).catch(
    (): CalendarResult => ({ items: [], google: "off" }),
  );
  return <WeekStrip days={days} today={today} items={data.items} google={data.google} />;
}

export function WeekStripPlaceholder({ days, today }: { days: string[]; today: string }) {
  return (
    <div aria-hidden="true" data-week-strip-placeholder="">
      <ol className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <li
            key={d}
            className={`flex h-16 flex-col items-center justify-center gap-1 rounded-md ${d === today ? "bg-accent-soft" : ""}`}
          >
            <span className="text-xs text-muted">{WEEKDAYS[i]}</span>
            <span className="text-sm text-muted tabular-nums">{Number(d.slice(8, 10))}</span>
            <span className="h-1" />
          </li>
        ))}
      </ol>
    </div>
  );
}
