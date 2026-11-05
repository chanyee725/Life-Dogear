"use client";

import Link from "next/link";
import {
  calendarHref,
  dayDots,
  isOneDay,
  itemsOn,
  spokenDay,
  WEEKDAYS,
} from "@/components/calendar/model";
import { SourceDot } from "@/components/calendar/SourceIcon";
import { visibleItems } from "@/components/calendar/sources";
import { useSources } from "@/components/calendar/useSources";
import { cn } from "@/components/ui/cn";
import type { CalendarItem, GoogleStatus } from "@/lib/calendar/types";

/**
 * Home "이번 주" strip (calendar.md 9절): seven days Mon–Sun, today highlighted, up to three
 * source dots per day; each day opens the 2-week calendar with that day selected. Follows the "표시" choice.
 */
export function WeekStrip({
  days,
  today,
  items,
  google,
}: {
  days: string[];
  today: string;
  items: CalendarItem[];
  google: GoogleStatus;
}) {
  const [choice] = useSources();
  const shown = visibleItems(items, choice, google);
  return (
    <nav aria-label="이번 주">
      <ol className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          // Single-day items only: periods (goals, reviews) would dot every day (9절).
          const on = itemsOn(shown, d).filter(isOneDay);
          const isToday = d === today;
          return (
            <li key={d}>
              <Link
                href={calendarHref({ date: d, day: d })}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${spokenDay(d)}, ${on.length ? `항목 ${on.length}개` : "항목 없음"}`}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 rounded-md hover:bg-hover",
                  isToday && "bg-accent-soft",
                )}
              >
                <span className="text-xs text-muted">{WEEKDAYS[i]}</span>
                <span
                  className={cn(
                    "text-sm tabular-nums",
                    isToday ? "font-semibold text-fg" : d < today ? "text-muted" : "text-fg",
                  )}
                >
                  {Number(d.slice(8, 10))}
                </span>
                <span className="flex h-1 items-center gap-0.5" aria-hidden="true">
                  {dayDots(on).map((dot) => (
                    <SourceDot
                      key={dot.source}
                      source={dot.source}
                      hollow={dot.hollow}
                    />
                  ))}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
