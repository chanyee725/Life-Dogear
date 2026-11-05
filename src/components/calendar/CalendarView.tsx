"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createTask, updateTask } from "@/app/_actions/tasks";
import { DateField } from "@/components/fields/DateField";
import { useGraphTheme, type GraphTheme } from "@/components/graph/graph-theme";
import { safeAction } from "@/components/links/safe-action";
import { addDays } from "@/components/tasks/format";
import { Button, Checkbox, cn, Input, Spinner } from "@/components/ui";
import { AnchoredMenu } from "@/components/ui/Menu";
import { mergeAdded, pendingAdded } from "@/lib/calendar/dedupe";
import type { CalendarItem, GoogleStatus } from "@/lib/calendar/types";
import { revealAdded } from "./add-event";
import { ChevronDownIcon } from "lucide-react";
import { AddEventButton } from "./AddEventButton";
import { CalendarItemRow, itemLabel, type ItemHandlers } from "./CalendarItemRow";
import {
  MONTH_LINES,
  TWO_WEEK_LINES,
  WEEKDAYS,
  calendarHref,
  dayDots,
  dayOf,
  gridWeeks,
  isMovable,
  isOneDay,
  itemsOn,
  layoutWeek,
  moveItemTo,
  navDay,
  revertItem,
  nextMonday,
  rangeTitle,
  shortDay,
  spokenDay,
  splitPeriodLine,
  stepDate,
  visibleSpan,
  type CalendarRangeKind,
  type WeekBar,
  WEEKS,
  weekdayIndex,
} from "./model";
import { Popover } from "./Popover";
import { TodayPanel } from "./TodayPanel";
import { SourceDot, SourceIcon, sourceColor, sourceTint } from "./SourceIcon";
import { SOURCES, SOURCE_LABEL, noneChosen, visibleItems } from "./sources";
import { useSources } from "./useSources";

const TITLE_MAX = 300;
/** Mouse travel (px) before a press on a task becomes a drag (5.1). */
const DRAG_THRESHOLD = 4;
/** Touch: hold this long for the item menu (5.3). */
const LONG_PRESS_MS = 500;
const ERROR_MS = 5000;
/** Bar lane height + gap (px): `h-5` + `gap-0.5`. */
const LANE_PX = 22;
const GOALS_SHOWN = 3;

export type CalendarViewProps = {
  range: CalendarRangeKind;
  /** Anchor date (the month/week shown). */
  date: string;
  /** Seoul `YYYY-MM-DD`, decided on the server. */
  today: string;
  items: CalendarItem[];
  google: GoogleStatus;
  /** Google Calendar write is set up: '일정 추가' in the toolbar is enabled. */
  googleWrite?: boolean;
  /** App data could not be loaded (10절). */
  failed?: boolean;
  /** Day the today panel starts on (`?day=`); ignored unless it is on the grid. */
  day?: string;
  /** Server time (ISO), so "그날 남은 것" agrees between server and client render. */
  now: string;
  /** Use the narrow (< 640px) layout regardless of the viewport — for server-rendered tests. */
  forceNarrow?: boolean;
  /** Mirror range/date/day into the address bar (the 할 일 page). Off when embedded (home). */
  syncUrl?: boolean;
  /** Told the selected day whenever it changes (home: the 할 일 추가 input's due date). */
  onSelectDay?: (day: string) => void;
  /** Home: shown in the today panel between the day and "다음 일정" (the loading line). */
  panelSlot?: ReactNode;
  /**
   * Narrow layout only: list the selected day's items under the grid (default). Home turns it
   * off — its today panel above already lists the day.
   */
  dayList?: boolean;
  /** Home: shown under the grid, in the grid's column (inbox / weekly review lines). */
  belowGrid?: ReactNode;
  /** Home: at the right end of the toolbar (빠른 추가). */
  toolbarEnd?: ReactNode;
  /**
   * Home: from `lg` the panel takes the left column's height and scrolls inside ("다음 일정"
   * first), so a long panel never leaves a gap under the calendar.
   */
  fitPanel?: boolean;
  /** Items still on their way (home streams them): the grid is `aria-busy`, the panel says so. */
  loading?: boolean;
  /** `data-testid` on the grid (home: "home-calendar-grid"). */
  gridTestId?: string;
};

type Pop =
  | { kind: "sources"; anchor: HTMLElement }
  | { kind: "day" | "add"; day: string; anchor: HTMLElement }
  | { kind: "menu" | "move"; item: CalendarItem; anchor: HTMLElement };

type Drag = { item: CalendarItem; pointerId: number; x0: number; y0: number; active: boolean };

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}

/** Day under a viewport point: the week row there, then the column by x. */
function dayAt(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const week = (el as HTMLElement).closest?.<HTMLElement>("[data-cal-week]");
    if (!week) continue;
    const days = week.dataset.calWeek!.split(",");
    const r = week.getBoundingClientRect();
    const col = Math.floor(((x - r.left) / r.width) * days.length);
    return days[Math.min(days.length - 1, Math.max(0, col))] ?? null;
  }
  return null;
}

export function CalendarView({
  range,
  date,
  today,
  items: serverItems,
  google: googleStatus,
  googleWrite = false,
  failed = false,
  day,
  now,
  forceNarrow = false,
  syncUrl = true,
  onSelectDay,
  panelSlot,
  dayList = true,
  belowGrid,
  toolbarEnd,
  fitPanel = false,
  loading = false,
  gridTestId,
}: CalendarViewProps) {
  const router = useRouter();
  const theme = useGraphTheme();
  const narrow = useNarrow() || forceNarrow;
  const [choice, setChoice] = useSources();
  const [navPending, startNav] = useTransition();
  const [, startSave] = useTransition();

  // Google events added here: kept over server refreshes until the feed has them (up to 10 min).
  const [added, setAdded] = useState<CalendarItem[]>([]);
  const [revealGoogle, setRevealGoogle] = useState(false);
  const google: GoogleStatus = revealGoogle && googleStatus === "off" ? "ok" : googleStatus;

  // Local copy for optimistic changes; reset whenever the server sends new items.
  const [items, setItems] = useState<CalendarItem[]>(serverItems);
  const [prevItems, setPrevItems] = useState(serverItems);
  if (prevItems !== serverItems) {
    setPrevItems(serverItems);
    // Drop added events the server list now carries, so `added` does not only grow.
    const pending = pendingAdded(serverItems, added);
    if (pending !== added) setAdded(pending);
    setItems(mergeAdded(serverItems, pending));
  }

  const onEventAdded = (item: CalendarItem) => {
    setAdded((list) => [...list, item]);
    setItems((list) => mergeAdded(list, [item]));
    const next = revealAdded(choice, google);
    if (next.choice !== choice) setChoice(next.choice);
    if (next.google !== google) setRevealGoogle(true);
  };

  const weeks = useMemo(() => gridWeeks(range, date), [range, date]);
  const gridDays = useMemo(() => weeks.flat(), [weeks]);
  const span = visibleSpan(range, date);
  const defaultDay =
    day && gridDays.includes(day)
      ? day
      : today >= gridDays[0]! && today <= gridDays.at(-1)!
        ? today
        : span.from;

  // Roving focus day (one tab stop for the grid) = the selected day the panel shows (13.2).
  const [focusDay, setFocusDay] = useState(defaultDay);
  const selected = focusDay;
  const [prevKey, setPrevKey] = useState(`${range}:${date}`);
  if (prevKey !== `${range}:${date}`) {
    setPrevKey(`${range}:${date}`);
    if (!gridDays.includes(focusDay)) setFocusDay(defaultDay);
  }

  // Keep `?day=` in step with the selection (no server round trip) so reload/back keep it.
  useEffect(() => {
    if (!syncUrl) return;
    const href = calendarHref({ range, date, day: selected }, today);
    if (`${window.location.pathname}${window.location.search}` !== href)
      window.history.replaceState(window.history.state, "", href);
  }, [range, date, selected, today, syncUrl]);

  useEffect(() => {
    onSelectDay?.(selected);
  }, [selected, onSelectDay]);

  const [pop, setPop] = useState<Pop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [drag, setDrag] = useState<{
    id: string;
    title: string;
    x: number;
    y: number;
    over: string | null;
  } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const pendingFocus = useRef<{ day: string } | { item: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const helpId = useId();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), ERROR_MS);
    return () => clearTimeout(t);
  }, [error]);

  // Put focus back after a move/navigation re-rendered the target elsewhere.
  useEffect(() => {
    const p = pendingFocus.current;
    const root = rootRef.current;
    if (!p || !root) return;
    const el =
      "day" in p
        ? root.querySelector<HTMLElement>(`[data-cal-cell="${p.day}"]`)
        : root.querySelector<HTMLElement>(`[data-cal-item="${CSS.escape(p.item)}"]`);
    if (el) {
      pendingFocus.current = null;
      el.focus();
    }
  });

  const shown = useMemo(() => visibleItems(items, choice, google), [items, choice, google]);
  const { line, rest } = useMemo(() => splitPeriodLine(shown, span), [shown, span.from, span.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = useCallback(
    (to: { range?: CalendarRangeKind; date?: string }) =>
      startNav(() => router.push(calendarHref({ range, date, ...to }, today), { scroll: false })),
    [router, range, date, today],
  );

  const focusCell = (day: string) => {
    setFocusDay(day);
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-cal-cell="${day}"]`);
    if (el) el.focus();
    else pendingFocus.current = { day };
  };

  /** `flip`: always open the target's own month (PageUp/PageDown), even onto a filler day. */
  const goDay = (day: string, flip = false) => {
    const otherMonth = range === "month" && day.slice(0, 7) !== date.slice(0, 7);
    if (gridDays.includes(day) && !(flip && otherMonth)) focusCell(day);
    else {
      setFocusDay(day);
      pendingFocus.current = { day };
      navigate({ date: day });
    }
  };

  // ---- saving ----
  const moveTask = (item: CalendarItem, to: string, focus = false) => {
    // Temp quick-add rows (taskId "") are not movable until saved.
    if (!isMovable(item) || to === dayOf(item.start)) return;
    setItems((list) => moveItemTo(list, item.id, to));
    if (focus) pendingFocus.current = { item: item.id };
    startSave(async () => {
      const result = await safeAction(() => updateTask(item.taskId, { dueDate: to }));
      if (!result.ok) {
        setItems((list) => revertItem(list, item));
        setError("마감일을 바꾸지 못했습니다.");
        setAnnounce(`${item.title}, 마감일을 바꾸지 못했습니다`);
      } else {
        setError(null);
        setAnnounce(`${item.title}, 마감 ${shortDay(to)}로 옮김`);
      }
    });
  };

  const completeTask = (item: CalendarItem) => {
    if (!item.taskId) return;
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, done: true } : i)));
    startSave(async () => {
      const result = await safeAction(() => updateTask(item.taskId, { done: true }));
      if (!result.ok) {
        setItems((list) => revertItem(list, item));
        setError(result.error);
      } else {
        setAnnounce(`${item.title}, 완료`);
      }
    });
  };

  /** Quick add; resolves to an error message or null. */
  const addTask = async (day: string, title: string): Promise<string | null> => {
    const value = title.replace(/\s+/g, " ").trim();
    if (!value) return null;
    if (value.length > TITLE_MAX) return `${TITLE_MAX}자까지 쓸 수 있습니다.`;
    const tempId = `task:new-${Date.now()}`;
    setItems((list) => [
      ...list,
      {
        id: tempId,
        source: "task",
        title: value,
        start: day,
        allDay: true,
        href: "/tasks",
        taskId: "",
      },
    ]);
    const result = await safeAction(() => createTask({ title: value, parent: null, dueDate: day }));
    if (!result.ok) {
      setItems((list) => list.filter((i) => i.id !== tempId));
      return result.error;
    }
    setItems((list) =>
      list.map((i) =>
        i.id === tempId ? { ...i, id: `task:${result.data.id}`, taskId: result.data.id } : i,
      ),
    );
    setAnnounce(`${spokenDay(day)} 마감 ${value} 추가`);
    return null;
  };

  // ---- popovers ----
  const closePop = (refocus: boolean) => {
    const anchor = pop?.anchor;
    setPop(null);
    if (refocus && anchor?.isConnected) anchor.focus();
  };
  const openMenu = (item: CalendarItem, anchor: HTMLElement) => {
    if (!isMovable(item)) return;
    setPop({ kind: "menu", item, anchor });
  };

  // ---- pointer: mouse/pen drag, touch long press ----
  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dragRef.current = null;
        setDrag(null);
        suppressClick.current = true;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drag]);

  const handlers: ItemHandlers = {
    onPointerDown: (item, e) => {
      if (!isMovable(item)) return;
      if (e.pointerType === "touch") {
        const el = e.currentTarget;
        clearPress();
        pressTimer.current = setTimeout(() => {
          suppressClick.current = true;
          openMenu(item, el);
        }, LONG_PRESS_MS);
        dragRef.current = {
          item,
          pointerId: e.pointerId,
          x0: e.clientX,
          y0: e.clientY,
          active: false,
        };
        return;
      }
      if (e.button !== 0 || narrow) return;
      dragRef.current = {
        item,
        pointerId: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        active: false,
      };
    },
    onPointerMove: (e) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const moved = Math.hypot(e.clientX - d.x0, e.clientY - d.y0);
      if (e.pointerType === "touch") {
        if (moved > 8) {
          clearPress();
          dragRef.current = null;
        }
        return;
      }
      if (!d.active) {
        if (moved < DRAG_THRESHOLD) return;
        d.active = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      setDrag({
        id: d.item.id,
        title: d.item.title,
        x: e.clientX,
        y: e.clientY,
        over: dayAt(e.clientX, e.clientY),
      });
    },
    onPointerUp: (item, e) => {
      clearPress();
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || e.pointerId !== d.pointerId || !d.active) return;
      setDrag(null);
      suppressClick.current = true;
      const to = dayAt(e.clientX, e.clientY);
      if (to) moveTask(item, to);
    },
    onPointerCancel: () => {
      clearPress();
      dragRef.current = null;
      setDrag(null);
    },
    onContextMenu: (item, e) => {
      if (!isMovable(item)) return;
      e.preventDefault();
      clearPress();
      openMenu(item, e.currentTarget);
    },
    onClick: (e) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        e.preventDefault();
      }
    },
    onKeyDown: (item, e) => {
      if (!isMovable(item)) return;
      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        e.stopPropagation();
        const to = addDays(dayOf(item.start), e.key === "[" ? -1 : 1);
        moveTask(item, to, true);
        setFocusDay(to);
        if (!gridDays.includes(to) && !narrow) navigate({ date: to });
      } else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
        e.preventDefault();
        e.stopPropagation();
        openMenu(item, e.currentTarget);
      }
    },
  };

  // ---- grid keyboard (5.2) ----
  const navList = (day: string): HTMLElement[] => {
    const root = rootRef.current;
    if (!root) return [];
    return [
      ...root.querySelectorAll<HTMLElement>(`[data-cal-on~="${day}"]`),
      ...root.querySelectorAll<HTMLElement>(`[data-cal-cell="${day}"] [data-cal-nav]`),
    ];
  };
  const onGridKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const cellDay = target.dataset.calCell;
    if (cellDay) {
      const to = navDay(range, cellDay, e.key);
      if (to) {
        e.preventDefault();
        if (to !== cellDay) goDay(to, e.key === "PageUp" || e.key === "PageDown");
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (narrow) return;
        const list = navList(cellDay).filter((el) => !el.hasAttribute("data-cal-add"));
        if (list.length) list[0]!.focus();
        else setPop({ kind: "add", day: cellDay, anchor: target });
      }
      return;
    }
    if (!target.hasAttribute("data-cal-nav")) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const list = navList(focusDay);
      const i = list.indexOf(target);
      const next = list[i + (e.key === "ArrowDown" ? 1 : -1)];
      next?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      focusCell(focusDay);
    }
  };

  const openAdd = (day: string, anchor: HTMLElement) => {
    setFocusDay(day);
    setPop({ kind: "add", day, anchor });
  };
  const openDay = (day: string, anchor: HTMLElement) => {
    setFocusDay(day);
    setPop({ kind: "day", day, anchor });
  };

  const ctx: GridCtx = {
    range,
    date,
    today,
    theme,
    focusDay,
    selected,
    draggingId: drag?.id ?? null,
    overDay: drag?.over ?? null,
    handlers,
    onFocusCell: setFocusDay,
    onSelect: setFocusDay,
    openAdd,
    openDay,
  };

  const weeksLabel = range === "month" ? null : `${WEEKS[range]}주`;
  const prevLabel = weeksLabel ? `이전 ${weeksLabel}` : "이전 달";
  const nextLabel = weeksLabel ? `다음 ${weeksLabel}` : "다음 달";
  const goToday = () => {
    setFocusDay(today);
    pendingFocus.current = { day: today };
    if (gridDays.includes(today)) focusCell(today);
    else navigate({ date: today });
  };
  const goals = line.filter((i) => i.source === "goal");
  const others = line.filter((i) => i.source !== "goal");

  return (
    <div ref={rootRef} className="mt-6 flex flex-col">
      {/* Toolbar (1절) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 max-sm:w-full">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={prevLabel}
            onClick={() => navigate({ date: stepDate(range, date, -1) })}
          >
            <span aria-hidden="true">‹</span>
          </Button>
          <h2
            aria-live="polite"
            className="text-base font-semibold tracking-tight tabular-nums max-sm:flex-1 max-sm:text-center sm:order-last"
          >
            {rangeTitle(range, date)}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 sm:order-2"
            aria-label={nextLabel}
            onClick={() => navigate({ date: stepDate(range, date, 1) })}
          >
            <span aria-hidden="true">›</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="sm:order-3"
            onClick={() => {
              setFocusDay(today);
              navigate({ date: today });
            }}
          >
            오늘
          </Button>
          {navPending ? <Spinner className="size-3 border sm:order-last" /> : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <AddEventButton enabled={googleWrite} defaultDate={focusDay} onAdded={onEventAdded} />
          <Button
            variant="secondary"
            size="sm"
            aria-haspopup="dialog"
            aria-expanded={pop?.kind === "sources"}
            onClick={(e) =>
              setPop(pop?.kind === "sources" ? null : { kind: "sources", anchor: e.currentTarget })
            }
          >
            표시 <ChevronDownIcon aria-hidden="true" className="size-3.5" />
          </Button>
          {toolbarEnd}
        </div>
      </div>

      {/* 13.1: two columns from lg (calendar | panel); below lg the panel goes first. */}
      <div
        className={cn(
          "mt-4 flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:gap-8",
          fitPanel ? "lg:items-stretch" : "lg:items-start",
        )}
      >
        <div className="flex min-w-0 flex-col">
          {/* Messages (10절) and the period line (3.3) */}
          <div className="mb-2 flex flex-col gap-1 empty:hidden">
            {failed ? (
              <p role="status" className="text-[13px] text-muted">
                달력을 불러오지 못했습니다.{" "}
                <button
                  type="button"
                  className="underline hover:text-fg"
                  onClick={() => startNav(() => router.refresh())}
                >
                  다시 시도
                </button>
              </p>
            ) : null}
            {(google === "error" || google === "partial") && choice.google ? (
              <p className="text-[13px] text-muted">
                {google === "partial"
                  ? "캘린더 일정 일부를 불러오지 못했습니다."
                  : "캘린더를 불러오지 못했습니다."}{" "}
                <button
                  type="button"
                  className="underline hover:text-fg"
                  onClick={() => startNav(() => router.refresh())}
                >
                  다시 시도
                </button>
              </p>
            ) : null}
            {noneChosen(choice, google) ? (
              <p className="flex items-center gap-2 text-[13px] text-muted">
                표시할 항목을 고르지 않았습니다.
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => setPop({ kind: "sources", anchor: e.currentTarget })}
                >
                  표시 설정
                </Button>
              </p>
            ) : null}
            {error ? <p className="text-[13px] text-danger">{error}</p> : null}
            {line.length ? (
              <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] max-sm:flex-col max-sm:items-start">
                {[...goals.slice(0, goals.length > 4 ? GOALS_SHOWN : 4), ...others].map((it) => (
                  <li key={it.id} className="flex min-w-0 items-center gap-1.5">
                    <SourceIcon source={it.source} theme={theme} />
                    {it.href ? (
                      <Link
                        href={it.href}
                        aria-label={itemLabel(it, today)}
                        className="max-w-60 truncate text-fg hover:underline"
                      >
                        {it.title}
                      </Link>
                    ) : (
                      <span className="max-w-60 truncate text-fg">{it.title}</span>
                    )}
                  </li>
                ))}
                {goals.length > 4 ? (
                  <li>
                    <Link
                      href="/goals"
                      className="text-muted tabular-nums hover:text-fg"
                      aria-label={`분기 목표 ${goals.length - GOALS_SHOWN}개 더 보기`}
                    >
                      +{goals.length - GOALS_SHOWN}
                    </Link>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
          <p aria-live="polite" className="sr-only">
            {announce}
          </p>
          <p id={helpId} className="sr-only">
            화살표로 날짜 이동, Enter로 항목 보기.
          </p>

          <div
            role="grid"
            aria-label={rangeTitle(range, date)}
            aria-describedby={helpId}
            aria-readonly="true"
            aria-busy={loading || undefined}
            data-testid={gridTestId}
            onKeyDown={onGridKeyDown}
            className="overflow-hidden rounded-lg border-t border-l border-border"
          >
            <div role="row" className="grid grid-cols-7">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  role="columnheader"
                  className={cn(
                    "grid h-8 place-items-center border-r border-b border-border text-xs",
                    w === "토" ? "text-sat" : w === "일" ? "text-sun" : "text-muted",
                  )}
                >
                  {w}
                </div>
              ))}
            </div>
            {weeks.map((days) =>
              narrow ? (
                <NarrowMonthRow key={days[0]} days={days} items={rest} ctx={ctx} />
              ) : (
                <WeekRow key={days[0]} days={days} items={rest} ctx={ctx} />
              ),
            )}
          </div>

          {narrow && dayList ? <DayList day={selected} items={rest} ctx={ctx} /> : null}
          {belowGrid}
        </div>
        {/* fitPanel: the wrapper adds no height (absolute child), so the row = the grid column.
            The scroll box reaches 8px past each side and pads it back: the rows' hover fill
            (`-mx-2`) stays inside instead of scrolling sideways. */}
        <div className={cn("order-first min-w-0 lg:order-none", fitPanel && "lg:relative")}>
          <TodayPanel
            className={
              fitPanel
                ? "lg:absolute lg:inset-y-0 lg:-inset-x-2 lg:overflow-x-hidden lg:overflow-y-auto lg:px-2 lg:pt-1"
                : "lg:pt-1"
            }
            day={selected}
            today={today}
            now={now}
            items={shown}
            theme={theme}
            onToday={goToday}
            onAdd={(anchor) => openAdd(selected, anchor)}
            gridEnd={gridDays.at(-1)}
            onGoto={(d) => goDay(d)}
            fit={fitPanel}
            loading={loading}
          >
            {panelSlot}
          </TodayPanel>
        </div>
      </div>

      {drag ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 flex h-5 max-w-48 items-center rounded-[4px] bg-bg px-1 text-xs text-fg shadow-overlay"
          style={{ left: drag.x + 8, top: drag.y + 8 }}
        >
          <span className="truncate">{drag.title}</span>
        </div>
      ) : null}

      {pop?.kind === "sources" ? (
        <Popover anchor={pop.anchor} onClose={closePop} label="표시" className="w-56 p-2">
          <ul className="flex flex-col">
            {SOURCES.map((s) => {
              const off = s === "google" && google === "off";
              return (
                <li key={s}>
                  <label
                    className={cn(
                      "flex h-8 items-center gap-2 rounded-md px-2 hover:bg-hover",
                      off && "opacity-60",
                    )}
                  >
                    <Checkbox
                      checked={choice[s] && !off}
                      disabled={off}
                      onCheckedChange={(checked) => setChoice({ ...choice, [s]: checked })}
                    />
                    <SourceIcon source={s} theme={theme} />
                    <span className="text-sm text-fg">{SOURCE_LABEL[s]}</span>
                    {off ? (
                      <Link
                        href="/settings#calendar"
                        className="ml-auto text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
                      >
                        설정하기
                      </Link>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        </Popover>
      ) : null}
      {pop?.kind === "day" ? (
        <Popover
          anchor={pop.anchor}
          onClose={closePop}
          label={spokenDay(pop.day)}
          className="max-h-80 w-64 overflow-auto p-2"
        >
          <DayPanel
            day={pop.day}
            items={itemsOn(rest, pop.day)}
            ctx={ctx}
            onAdd={() => setPop({ kind: "add", day: pop.day, anchor: pop.anchor })}
          />
        </Popover>
      ) : null}
      {pop?.kind === "add" ? (
        <Popover
          anchor={pop.anchor}
          onClose={closePop}
          label={`${spokenDay(pop.day)} 마감 할 일 추가`}
          className="w-72 p-3"
        >
          <AddPanel day={pop.day} onAdd={addTask} />
        </Popover>
      ) : null}
      {pop?.kind === "menu" ? (
        <AnchoredMenu
          anchor={pop.anchor}
          onClose={closePop}
          label={`할 일 메뉴: ${pop.item.title}`}
          items={[
            ...(pop.item.href
              ? [
                  {
                    label: "열기",
                    run: () => {
                      setPop(null);
                      router.push(pop.item.href!);
                    },
                  },
                ]
              : []),
            {
              label: "날짜 옮기기…",
              run: () => setPop({ kind: "move", item: pop.item, anchor: pop.anchor }),
            },
            {
              label: "완료로 표시",
              run: () => {
                closePop(true);
                completeTask(pop.item);
              },
            },
          ]}
        />
      ) : null}
      {pop?.kind === "move" ? (
        <Popover
          anchor={pop.anchor}
          onClose={closePop}
          label="날짜 옮기기"
          className="flex flex-col gap-2 p-3"
        >
          <MovePanel
            value={dayOf(pop.item.start)}
            today={today}
            onPick={(to) => {
              const item = pop.item;
              setPop(null);
              moveTask(item, to, true);
              setFocusDay(to);
              if (!gridDays.includes(to) && !narrow) navigate({ date: to });
            }}
          />
        </Popover>
      ) : null}
    </div>
  );
}

// ---- toolbar ------------------------------------------------------------------------------

// ---- grid ---------------------------------------------------------------------------------

type GridCtx = {
  range: CalendarRangeKind;
  date: string;
  today: string;
  theme: GraphTheme;
  focusDay: string;
  selected: string;
  draggingId: string | null;
  overDay: string | null;
  handlers: ItemHandlers;
  onFocusCell: (day: string) => void;
  onSelect: (day: string) => void;
  openAdd: (day: string, anchor: HTMLElement) => void;
  openDay: (day: string, anchor: HTMLElement) => void;
};

const cellLabel = (day: string, today: string, count: number) =>
  `${day === today ? "오늘, " : ""}${spokenDay(day)}, ${count ? `항목 ${count}개` : "항목 없음"}`;

function DayNumber({
  day,
  today,
  muted,
  selected = false,
  plain = false,
  onClick,
}: {
  day: string;
  today: string;
  muted: boolean;
  /** 13.2: ring around the number (outside the accent circle on today). */
  selected?: boolean;
  plain?: boolean;
  onClick?: () => void;
}) {
  const isToday = day === today;
  const n = Number(day.slice(8, 10));
  // Month name on the 1st only where there is room (not in the narrow dot cells).
  const text = n === 1 && !plain ? `${Number(day.slice(5, 7))}월 1일` : String(n);
  return (
    <span
      aria-hidden="true"
      onClick={onClick}
      className={cn(
        "grid h-6 min-w-6 shrink-0 place-items-center self-start rounded-full text-xs tabular-nums",
        plain && "self-auto",
        text.length > 2 && "w-auto px-1",
        isToday
          ? "bg-accent font-semibold text-accent-fg"
          : cn(
              weekdayIndex(day) === 5
                ? "text-sat"
                : weekdayIndex(day) === 6
                  ? "text-sun"
                  : "text-fg",
              muted && "opacity-50",
            ),
        selected && "ring-1 ring-border-strong",
        selected && isToday && "ring-offset-1 ring-offset-bg",
      )}
    >
      {text}
    </span>
  );
}

/** One week row of the month or 2-week grid (wide screens). */
function WeekRow({ days, items, ctx }: { days: string[]; items: CalendarItem[]; ctx: GridCtx }) {
  const month = ctx.range === "month";
  const layout = layoutWeek(items, days, month ? MONTH_LINES : TWO_WEEK_LINES);
  const monthKey = ctx.date.slice(0, 7);
  // Bars sit under the day number: p-1 + h-6 + gap.
  const barTop = 4 + 24 + 2;

  return (
    <div role="row" data-cal-week={days.join(",")} className="relative grid grid-cols-7">
      {layout.cells.map((cell) => {
        const d = cell.day;
        const outside = month && d.slice(0, 7) !== monthKey;
        const isEmpty = cell.all.length === 0;
        return (
          <div
            key={d}
            role="gridcell"
            data-cal-cell={d}
            tabIndex={d === ctx.focusDay ? 0 : -1}
            aria-selected={d === ctx.selected}
            aria-current={d === ctx.today ? "date" : undefined}
            aria-label={cellLabel(d, ctx.today, cell.all.length)}
            onFocus={(e) => e.target === e.currentTarget && ctx.onFocusCell(d)}
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              ctx.onSelect(d);
              if (isEmpty) ctx.openAdd(d, e.currentTarget);
            }}
            className={cn(
              "group relative flex min-w-0 flex-col gap-0.5 border-r border-b border-border p-1 focus-visible:outline-offset-[-2px]",
              month ? "h-28" : "h-24 lg:h-[7.25rem]",
              outside && "bg-surface",
              ctx.overDay === d && "bg-accent-soft outline-2 -outline-offset-2 outline-accent",
            )}
          >
            <DayNumber
              day={d}
              today={ctx.today}
              muted={outside}
              selected={d === ctx.selected}
              onClick={() => ctx.onSelect(d)}
            />
            {layout.lanes ? (
              <div
                aria-hidden="true"
                className="pointer-events-none shrink-0"
                style={{ height: layout.lanes * LANE_PX - 2 }}
              />
            ) : null}
            {cell.shown.map((item) => (
              <CalendarItemRow
                key={item.id}
                item={item}
                today={ctx.today}
                theme={ctx.theme}
                size="month"
                hideTime={!month}
                dragging={ctx.draggingId === item.id}
                handlers={ctx.handlers}
              />
            ))}
            {cell.hidden ? (
              <button
                type="button"
                data-cal-nav=""
                tabIndex={-1}
                onClick={(e) => ctx.openDay(d, e.currentTarget)}
                aria-label={`${shortDay(d)} 항목 ${cell.hidden}개 더 보기`}
                className="flex h-5 shrink-0 items-center self-start px-1 text-xs text-muted tabular-nums hover:text-fg focus-visible:outline-offset-[-2px]"
              >
                +{cell.hidden}
              </button>
            ) : null}
            <button
              type="button"
              data-cal-nav=""
              data-cal-add=""
              tabIndex={-1}
              onClick={(e) => ctx.openAdd(d, e.currentTarget)}
              aria-label={`${shortDay(d)} 마감 할 일 추가`}
              className="absolute top-1 right-1 grid size-5 place-items-center rounded text-muted opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-hover hover:text-fg focus-visible:outline-offset-[-2px]"
            >
              <span aria-hidden="true">＋</span>
            </button>
          </div>
        );
      })}
      {layout.bars.map((bar) => (
        <Bar key={bar.item.id} bar={bar} days={days} top={barTop} ctx={ctx} />
      ))}
    </div>
  );
}

function Bar({ bar, days, top, ctx }: { bar: WeekBar; days: string[]; top: number; ctx: GridCtx }) {
  const { item } = bar;
  const on = days.slice(bar.col, bar.col + bar.span).join(" ");
  const color = sourceColor(ctx.theme, item.source);
  const className = cn(
    "absolute z-10 flex h-5 min-w-0 items-center gap-1.5 overflow-hidden rounded-[4px] px-1.5 text-xs text-fg focus-visible:outline-offset-[-2px]",
    !bar.continuesBefore && "border-l-[3px]",
    bar.continuesBefore && "rounded-l-none",
    bar.continuesAfter && "rounded-r-none",
  );
  const style = {
    top: top + bar.lane * LANE_PX,
    left: `calc(${(bar.col / 7) * 100}% + 2px)`,
    width: `calc(${(bar.span / 7) * 100}% - 4px)`,
    borderLeftColor: bar.continuesBefore ? undefined : color,
    background: sourceTint(ctx.theme, item.source, 16),
  };
  const body = (
    <>
      <span className="truncate">{item.title}</span>
    </>
  );
  const common = {
    "data-cal-on": on,
    "aria-label": itemLabel(item, ctx.today),
    tabIndex: -1,
    title: item.title,
    style,
    className,
  };
  return item.href ? (
    <Link {...common} data-cal-nav="" href={item.href}>
      {body}
    </Link>
  ) : (
    <div {...common}>{body}</div>
  );
}

function DayPanel({
  day,
  items,
  ctx,
  onAdd,
}: {
  day: string;
  items: CalendarItem[];
  ctx: GridCtx;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-1 pb-1 text-[13px] font-semibold">{spokenDay(day)}</p>
      {items.map((item) => (
        <CalendarItemRow
          key={item.id}
          item={item}
          today={ctx.today}
          theme={ctx.theme}
          size="week"
          tabbable
          handlers={ctx.handlers}
        />
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex h-6 items-center px-1 text-left text-xs text-muted hover:text-fg"
      >
        ＋ 할 일 추가
      </button>
    </div>
  );
}

function AddPanel({
  day,
  onAdd,
}: {
  day: string;
  onAdd: (day: string, title: string) => Promise<string | null>;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const errorId = useId();
  const tooLong = value.trim().length > TITLE_MAX;
  const submit = () => {
    if (!value.trim() || tooLong || pending) return;
    setPending(true);
    void onAdd(day, value).then((failure) => {
      setPending(false);
      if (failure) setError(failure);
      else {
        setError(null);
        setValue("");
      }
    });
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-muted">{spokenDay(day)} 마감</p>
      <Input
        autoFocus
        value={value}
        readOnly={pending}
        placeholder="할 일"
        aria-label={`${spokenDay(day)} 마감 할 일`}
        aria-invalid={tooLong || Boolean(error)}
        aria-describedby={tooLong || error ? errorId : undefined}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      {tooLong || error ? (
        <p id={errorId} className="text-xs text-danger">
          {tooLong ? `${TITLE_MAX}자까지 쓸 수 있습니다.` : error}
        </p>
      ) : null}
    </div>
  );
}

function MovePanel({
  value,
  today,
  onPick,
}: {
  value: string;
  today: string;
  onPick: (to: string) => void;
}) {
  return (
    <>
      <DateField autoFocus value={value} aria-label="마감일" onChange={(v) => v && onPick(v)} />
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => onPick(today)}>
          오늘
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onPick(addDays(today, 1))}>
          내일
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onPick(nextMonday(today))}>
          다음 주 월요일
        </Button>
      </div>
    </>
  );
}

// ---- narrow (< 640px, 8절) ----------------------------------------------------------------

function NarrowMonthRow({
  days,
  items,
  ctx,
}: {
  days: string[];
  items: CalendarItem[];
  ctx: GridCtx;
}) {
  const monthKey = ctx.date.slice(0, 7);
  return (
    <div role="row" data-cal-week={days.join(",")} className="grid grid-cols-7">
      {days.map((d) => {
        const on = itemsOn(items, d);
        const singles = on.filter(isOneDay);
        const bar = on.find((i) => i.end && i.end !== i.start);
        const outside = ctx.range === "month" && d.slice(0, 7) !== monthKey;
        const isSelected = d === ctx.selected;
        return (
          <div
            key={d}
            role="gridcell"
            data-cal-cell={d}
            tabIndex={d === ctx.focusDay ? 0 : -1}
            aria-selected={isSelected}
            aria-current={d === ctx.today ? "date" : undefined}
            aria-label={cellLabel(d, ctx.today, on.length)}
            onClick={() => ctx.onSelect(d)}
            className={cn(
              "relative flex h-14 min-w-0 cursor-pointer flex-col items-center gap-1 border-r border-b border-border p-0.5 focus-visible:outline-offset-[-2px]",
              outside && "bg-surface",
            )}
          >
            <DayNumber day={d} today={ctx.today} muted={outside} selected={isSelected} plain />
            <span className="flex h-1 items-center gap-0.5" aria-hidden="true">
              {dayDots(singles).map((dot) => (
                <SourceDot
                  key={dot.source}
                  source={dot.source}
                  hollow={dot.hollow}
                  theme={ctx.theme}
                />
              ))}
            </span>
            {bar ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0.5 h-0.5"
                style={{ backgroundColor: sourceColor(ctx.theme, bar.source), opacity: 0.5 }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DayList({ day, items, ctx }: { day: string; items: CalendarItem[]; ctx: GridCtx }) {
  const list = itemsOn(items, day);
  return (
    <section className="mt-4 flex flex-col" aria-label={spokenDay(day)}>
      <h3 className="pb-1 text-[13px] font-semibold">{spokenDay(day)}</h3>
      {list.map((item) => (
        <CalendarItemRow
          key={item.id}
          item={item}
          today={ctx.today}
          theme={ctx.theme}
          size="list"
          tabbable
          handlers={ctx.handlers}
        />
      ))}
      <AddButton day={day} ctx={ctx} />
    </section>
  );
}

function AddButton({ day, ctx }: { day: string; ctx: GridCtx }): ReactNode {
  return (
    <button
      type="button"
      onClick={(e) => ctx.openAdd(day, e.currentTarget)}
      aria-label={`${shortDay(day)} 마감 할 일 추가`}
      className="flex h-10 items-center px-1 text-left text-sm text-muted hover:text-fg"
    >
      ＋ 할 일 추가
    </button>
  );
}
