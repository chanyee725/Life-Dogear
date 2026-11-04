"use client";

import Link from "next/link";
import { useId } from "react";
import type { GraphTheme } from "@/components/graph/graph-theme";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import type { CalendarItem } from "@/lib/calendar/types";
import { itemLabel, titleClass } from "./CalendarItemRow";
import { spokenDay, timeOf } from "./model";
import { sourceColor, sourceTint } from "./SourceIcon";
import { groupHeading, originLabel, relativeDay, upcoming } from "./upcoming";

/**
 * Today panel (calendar.md 13.3): the selected day large, then "다음 일정" — what is left from
 * that day on, grouped by day. Each row is one link; selecting days stays in the grid.
 */
export function TodayPanel({
  day,
  today,
  now,
  items,
  theme,
  onToday,
  onAdd,
  className,
}: {
  day: string;
  today: string;
  now: string;
  /** Items after the "표시" filter. */
  items: readonly CalendarItem[];
  theme: GraphTheme;
  onToday: () => void;
  onAdd: (anchor: HTMLElement) => void;
  className?: string;
}) {
  const titleId = useId();
  const list = upcoming(items, day, today, now);
  const rel = relativeDay(day, today);
  return (
    <section aria-labelledby={titleId} className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <p className="h-5 text-[13px] text-muted">{rel ?? ""}</p>
          <h2
            id={titleId}
            aria-live="polite"
            className="text-2xl font-semibold tracking-tight tabular-nums max-sm:text-xl"
          >
            {spokenDay(day)}
          </h2>
        </div>
        {day !== today ? (
          <Button variant="ghost" size="sm" onClick={onToday}>
            오늘로
          </Button>
        ) : null}
      </div>

      <h3 className="mt-6 flex h-8 items-center gap-2 text-[13px] font-semibold text-muted">
        다음 일정
        <span className="text-xs font-normal tabular-nums">{list.shown + list.more}</span>
      </h3>

      {list.shown === 0 ? (
        <div className="flex flex-col items-start">
          <Button variant="ghost" size="sm" onClick={(e) => onAdd(e.currentTarget)}>
            ＋ 할 일 추가
          </Button>
        </div>
      ) : (
        <div className="flex flex-col">
          {list.groups.map((g) => (
            <section key={g.day} aria-label={spokenDay(g.day)} className="mt-4 first:mt-0">
              <h4
                className={cn(
                  "flex h-7 items-center text-xs font-semibold",
                  g.day === today ? "text-accent" : "text-muted",
                )}
              >
                {groupHeading(g.day, today)}
              </h4>
              <ul className="flex flex-col gap-1">
                {g.items.map((item) => (
                  <li key={item.id}>
                    <UpcomingRow item={item} today={today} theme={theme} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {list.more ? (
            <p className="mt-3 text-xs text-muted tabular-nums">이후 {list.more}개는 달력에서</p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function UpcomingRow({
  item,
  today,
  theme,
}: {
  item: CalendarItem;
  today: string;
  theme: GraphTheme;
}) {
  const time = timeOf(item);
  const origin = originLabel(item);
  const label = `${itemLabel(item, today)}${item.source === "task" && origin ? `, ${origin}` : ""}`;
  const className =
    "flex min-h-9 items-center gap-2.5 rounded-md border-l-[3px] py-1.5 pr-2 pl-2.5 text-sm hover:brightness-95 dark:hover:brightness-125 max-sm:min-h-11";
  const style = {
    borderLeftColor: sourceColor(theme, item.source),
    background: sourceTint(theme, item.source, item.done ? 5 : 10),
  };
  const body = (
    <>
      <span className="w-10 shrink-0 text-xs text-muted tabular-nums">{time ?? "종일"}</span>
      <span className={cn("min-w-0 flex-1 truncate", titleClass(item, today))}>{item.title}</span>
      {origin ? (
        <span className="max-w-28 shrink-0 truncate text-xs text-muted max-sm:hidden">
          {origin}
        </span>
      ) : null}
    </>
  );
  if (!item.href) {
    return (
      <span aria-label={label} title={item.title} className={className} style={style}>
        {body}
      </span>
    );
  }
  if (item.source === "google") {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={item.title}
        className={className}
        style={style}
      >
        {body}
      </a>
    );
  }
  return (
    <Link
      href={item.href}
      aria-label={label}
      title={item.title}
      className={className}
      style={style}
    >
      {body}
    </Link>
  );
}
