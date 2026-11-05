"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import type { GraphTheme } from "@/components/graph/graph-theme";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import type { CalendarItem } from "@/lib/calendar/types";
import { itemLabel, titleClass } from "./CalendarItemRow";
import { spokenDay, timeOf } from "./model";
import { sourceColor } from "./SourceIcon";
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
  fit = false,
  loading = false,
  className,
  children,
}: {
  day: string;
  today: string;
  now: string;
  /** Items after the "표시" filter. */
  items: readonly CalendarItem[];
  theme: GraphTheme;
  onToday: () => void;
  onAdd: (anchor: HTMLElement) => void;
  /** Fill the parent's height; "다음 일정" scrolls in what is left. */
  fit?: boolean;
  /** Items not here yet: "…" stands in for the count (never 0), no empty line. */
  loading?: boolean;
  className?: string;
  /** Between the day and "다음 일정" (home: the loading line). */
  children?: ReactNode;
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

      {children ? <div className="mt-4 flex flex-col gap-2">{children}</div> : null}

      <h3
        className={cn(
          "flex h-8 shrink-0 items-center gap-2 text-[13px] font-semibold text-muted",
          children ? "mt-2" : "mt-6",
        )}
      >
        다음 일정
        <span data-testid="next-count" className="text-xs font-normal tabular-nums">
          {loading ? "…" : list.shown + list.more}
        </span>
      </h3>

      {loading ? null : list.shown === 0 ? (
        children ? (
          // The add input sits right above; no second add button.
          <p className="text-xs text-muted">없음</p>
        ) : (
          <div className="flex flex-col items-start">
            <Button variant="ghost" size="sm" onClick={(e) => onAdd(e.currentTarget)}>
              ＋ 할 일 추가
            </Button>
          </div>
        )
      ) : (
        <div className={cn("flex flex-col", fit && "lg:min-h-32 lg:flex-1 lg:overflow-y-auto")}>
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
              <ul className="flex flex-col">
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
    "-mx-2 flex h-9 items-center gap-2.5 rounded-md px-2 text-sm hover:bg-hover max-sm:h-11";
  const body = (
    <>
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ background: sourceColor(theme, item.source), opacity: item.done ? 0.45 : 1 }}
      />
      {time ? <span className="shrink-0 text-xs text-muted tabular-nums">{time}</span> : null}
      <span className={cn("min-w-0 flex-1 truncate", titleClass(item, today))}>{item.title}</span>
      {origin && item.source !== "google" ? (
        <span className="max-w-28 shrink-0 truncate text-xs text-muted max-sm:hidden">
          {origin}
        </span>
      ) : null}
    </>
  );
  if (!item.href) {
    return (
      <span aria-label={label} title={item.title} className={className}>
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
      >
        {body}
      </a>
    );
  }
  return (
    <Link href={item.href} aria-label={label} title={item.title} className={className}>
      {body}
    </Link>
  );
}
