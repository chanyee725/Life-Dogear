"use client";

import Link from "next/link";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { GraphTheme } from "@/components/graph/graph-theme";
import { cn } from "@/components/ui/cn";
import type { CalendarItem } from "@/lib/calendar/types";
import { dayOf, isMovable, lastDay, shortDay, timeOf } from "./model";
import { SourceIcon } from "./SourceIcon";
import { SOURCE_LABEL } from "./sources";

/** Spoken label (calendar.md 2절): source first, e.g. "할 일: 2장 초안, 마감 11월 5일". */
export function itemLabel(item: CalendarItem, today: string): string {
  const first = dayOf(item.start);
  if (item.source === "google") {
    const time = timeOf(item);
    const when = time
      ? `${Number(time.slice(0, 2))}시${time.endsWith(":00") ? "" : ` ${Number(time.slice(3))}분`}, `
      : "";
    return `${SOURCE_LABEL.google}: ${when}${item.title}, Google 캘린더에서 열기`;
  }
  const last = lastDay(item);
  const range = last !== first ? `, ${shortDay(first)}부터 ${shortDay(last)}까지` : "";
  if (item.source === "task") {
    const state = item.done ? ", 완료" : first < today ? ", 마감 지남" : "";
    return `${SOURCE_LABEL.task}: ${item.title}, 마감 ${shortDay(first)}${state}`;
  }
  if (item.source === "project")
    return `${SOURCE_LABEL.project}: ${item.title}, 마감 ${shortDay(first)}`;
  if (item.source === "paper")
    return `${SOURCE_LABEL.paper}: ${item.title}, ${shortDay(first)}에 읽음`;
  return `${SOURCE_LABEL[item.source]}: ${item.title}${range}`;
}

/** Title color (4절): done tasks struck through, overdue open tasks red, past others muted. */
export function titleClass(item: CalendarItem, today: string): string {
  const past = lastDay(item) < today;
  if (item.source === "task") {
    if (item.done) return "text-muted line-through decoration-border-strong";
    return past ? "text-tone-red-fg" : "text-fg";
  }
  if (item.source === "google") return "text-muted";
  if (past && (item.source === "project" || item.source === "seminar")) return "text-muted";
  return "text-fg";
}

export type ItemHandlers = {
  onKeyDown: (item: CalendarItem, e: ReactKeyboardEvent<HTMLElement>) => void;
  onPointerDown: (item: CalendarItem, e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (item: CalendarItem, e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  onContextMenu: (item: CalendarItem, e: ReactMouseEvent<HTMLElement>) => void;
  onClick: (e: ReactMouseEvent<HTMLElement>) => void;
};

/** One calendar line: icon, optional time, title. `size` follows the view (3.2·7·8절). */
export function CalendarItemRow({
  item,
  today,
  theme,
  size,
  dragging = false,
  tabbable = false,
  handlers,
}: {
  item: CalendarItem;
  today: string;
  theme: GraphTheme;
  size: "month" | "week" | "list";
  dragging?: boolean;
  /** Outside the grid (narrow lists) items are ordinary tab stops. */
  tabbable?: boolean;
  handlers: ItemHandlers;
}) {
  const time = timeOf(item);
  const movable = isMovable(item);
  const className = cn(
    "flex min-w-0 items-center gap-1.5 rounded-[4px] px-1 hover:bg-hover focus-visible:outline-offset-[-2px]",
    size === "month" && "h-5 text-xs",
    size === "week" && "h-6 text-[13px]",
    size === "list" && "h-10 text-sm",
    movable && "hover:cursor-grab select-none",
    dragging && "opacity-40",
  );
  const body = (
    <>
      <SourceIcon source={item.source} done={item.done} theme={theme} />
      {time ? <span className="shrink-0 text-muted tabular-nums">{time}</span> : null}
      <span className={cn("truncate", titleClass(item, today))}>{item.title}</span>
    </>
  );
  const props = {
    "data-cal-item": item.id,
    "data-cal-nav": "",
    "aria-label": itemLabel(item, today),
    "aria-haspopup": item.taskId ? ("menu" as const) : undefined,
    tabIndex: tabbable ? 0 : -1,
    className,
    title: item.title,
    draggable: false,
    onClick: handlers.onClick,
    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => handlers.onKeyDown(item, e),
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => handlers.onPointerDown(item, e),
    onPointerMove: handlers.onPointerMove,
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => handlers.onPointerUp(item, e),
    onPointerCancel: handlers.onPointerCancel,
    onContextMenu: (e: ReactMouseEvent<HTMLElement>) => handlers.onContextMenu(item, e),
  };
  if (!item.href) return <span {...props}>{body}</span>;
  if (item.source === "google") {
    return (
      <a {...props} href={item.href} target="_blank" rel="noopener noreferrer">
        {body}
      </a>
    );
  }
  return (
    <Link {...props} href={item.href}>
      {body}
    </Link>
  );
}
