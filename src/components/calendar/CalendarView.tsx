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
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/components/ui/cn";
import type { CalendarItem, GoogleStatus } from "@/lib/calendar/types";
import { CalendarItemRow, itemLabel, type ItemHandlers } from "./CalendarItemRow";
import {
  MONTH_LINES,
  WEEKDAYS,
  calendarHref,
  dayDots,
  dayOf,
  gridWeeks,
  isMovable,
  itemsOn,
  layoutWeek,
  moveItemTo,
  navDay,
  nextMonday,
  rangeTitle,
  shortDay,
  spokenDay,
  splitPeriodLine,
  stepDate,
  visibleSpan,
  type CalendarRangeKind,
  type WeekBar,
} from "./model";
import { Popover } from "./Popover";
import { SourceDot, SourceIcon, sourceColor } from "./SourceIcon";
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
  /** App data could not be loaded (10절). */
  failed?: boolean;
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
  google,
  failed = false,
}: CalendarViewProps) {
  const router = useRouter();
  const theme = useGraphTheme();
  const narrow = useNarrow();
  const [choice, setChoice] = useSources();
  const [navPending, startNav] = useTransition();
  const [, startSave] = useTransition();

  // Local copy for optimistic changes; reset whenever the server sends new items.
  const [items, setItems] = useState<CalendarItem[]>(serverItems);
  const [prevItems, setPrevItems] = useState(serverItems);
  if (prevItems !== serverItems) {
    setPrevItems(serverItems);
    setItems(serverItems);
  }

  const weeks = useMemo(() => gridWeeks(range, date), [range, date]);
  const gridDays = useMemo(() => weeks.flat(), [weeks]);
  const span = visibleSpan(range, date);
  const defaultDay = today >= gridDays[0]! && today <= gridDays.at(-1)! ? today : span.from;

  // Roving focus day (one tab stop for the grid) and the narrow view's chosen day.
  const [focusDay, setFocusDay] = useState(defaultDay);
  const [selected, setSelected] = useState(defaultDay);
  const [prevKey, setPrevKey] = useState(`${range}:${date}`);
  if (prevKey !== `${range}:${date}`) {
    setPrevKey(`${range}:${date}`);
    if (!gridDays.includes(focusDay)) setFocusDay(defaultDay);
    if (!gridDays.includes(selected))
      setSelected(gridDays.includes(focusDay) ? focusDay : defaultDay);
  }

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

  const goDay = (day: string) => {
    if (narrow && range === "month") setSelected(day);
    if (gridDays.includes(day)) focusCell(day);
    else {
      setFocusDay(day);
      pendingFocus.current = { day };
      navigate({ date: day });
    }
  };

  // ---- saving ----
  const moveTask = (item: CalendarItem, to: string, focus = false) => {
    if (!isMovable(item) || to === dayOf(item.start)) return;
    const before = items;
    setItems(moveItemTo(items, item.id, to));
    if (focus) pendingFocus.current = { item: item.id };
    startSave(async () => {
      const result = await safeAction(() => updateTask(item.taskId, { dueDate: to }));
      if (!result.ok) {
        setItems(before);
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
    const before = items;
    setItems(items.map((i) => (i.id === item.id ? { ...i, done: true } : i)));
    startSave(async () => {
      const result = await safeAction(() => updateTask(item.taskId, { done: true }));
      if (!result.ok) {
        setItems(before);
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
        if (to !== cellDay) goDay(to);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (narrow && range === "month") {
          setSelected(cellDay);
          return;
        }
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
    onSelect: (day) => {
      setSelected(day);
      setFocusDay(day);
    },
    openAdd,
    openDay,
  };

  const empty = !failed && !noneChosen(choice, google) && shown.length === 0;
  const scope = range === "week" ? "이번 주에" : "이번 달에";
  const prevLabel = range === "week" ? "이전 주" : "이전 달";
  const nextLabel = range === "week" ? "다음 주" : "다음 달";
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
            onClick={() => navigate({ date: today })}
          >
            오늘
          </Button>
          {navPending ? <Spinner className="size-3 border sm:order-last" /> : null}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <RangeSwitch
            range={range}
            onPick={(r) =>
              navigate({ range: r, date: gridDays.includes(focusDay) ? focusDay : date })
            }
          />
          <Button
            variant="ghost"
            size="sm"
            aria-haspopup="dialog"
            aria-expanded={pop?.kind === "sources"}
            onClick={(e) =>
              setPop(pop?.kind === "sources" ? null : { kind: "sources", anchor: e.currentTarget })
            }
          >
            표시 <span aria-hidden="true">▾</span>
          </Button>
        </div>
      </div>

      {/* Messages (10절) and the period line (3.3) */}
      <div className="mt-3 mb-2 flex flex-col gap-1 empty:hidden">
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
          <p className="text-[13px] text-muted">
            표시할 항목을 고르지 않았습니다.{" "}
            <button
              type="button"
              className="underline hover:text-fg"
              onClick={(e) => setPop({ kind: "sources", anchor: e.currentTarget })}
            >
              표시
            </button>
            에서 켤 수 있습니다.
          </p>
        ) : null}
        {empty ? (
          <p className="text-[13px] text-muted">
            {scope} 표시할 날짜가 없습니다. 날짜를 눌러 할 일을 추가할 수 있습니다.
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
        화살표로 날짜 이동, Enter로 항목 보기, 할 일은 [ ] 로 하루씩 옮깁니다.
      </p>

      {narrow && range === "week" ? (
        <NarrowWeek days={weeks[0]!} items={rest} ctx={ctx} />
      ) : (
        <div
          role="grid"
          aria-label={rangeTitle(range, date)}
          aria-describedby={helpId}
          aria-readonly="true"
          onKeyDown={onGridKeyDown}
          className="overflow-hidden rounded-lg border-t border-l border-border"
        >
          {range === "month" ? (
            <div role="row" className="grid grid-cols-7">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  role="columnheader"
                  className="grid h-8 place-items-center border-r border-b border-border text-xs text-muted"
                >
                  {w}
                </div>
              ))}
            </div>
          ) : null}
          {weeks.map((days) =>
            narrow ? (
              <NarrowMonthRow key={days[0]} days={days} items={rest} ctx={ctx} />
            ) : (
              <WeekRow key={days[0]} days={days} items={rest} ctx={ctx} />
            ),
          )}
        </div>
      )}

      {narrow && range === "month" ? <DayList day={selected} items={rest} ctx={ctx} /> : null}

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
                    <input
                      type="checkbox"
                      checked={choice[s] && !off}
                      disabled={off}
                      onChange={(e) => setChoice({ ...choice, [s]: e.target.checked })}
                    />
                    <SourceIcon source={s} theme={theme} />
                    <span className="text-sm text-fg">{SOURCE_LABEL[s]}</span>
                    {off ? <span className="ml-auto text-xs text-muted">설정 안 됨</span> : null}
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
        <Popover
          anchor={pop.anchor}
          onClose={closePop}
          role="menu"
          label={`할 일 메뉴: ${pop.item.title}`}
          className="min-w-36 p-1"
        >
          <MenuPanel
            onOpen={
              pop.item.href
                ? () => {
                    setPop(null);
                    router.push(pop.item.href!);
                  }
                : undefined
            }
            onMove={() => setPop({ kind: "move", item: pop.item, anchor: pop.anchor })}
            onDone={() => {
              closePop(true);
              completeTask(pop.item);
            }}
            onTab={() => setPop(null)}
          />
        </Popover>
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

function RangeSwitch({
  range,
  onPick,
}: {
  range: CalendarRangeKind;
  onPick: (r: CalendarRangeKind) => void;
}) {
  const options: { value: CalendarRangeKind; label: string }[] = [
    { value: "month", label: "월" },
    { value: "week", label: "주" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="범위"
      className="flex h-7 gap-0.5 rounded-lg bg-subtle p-0.5"
    >
      {options.map((o) => {
        const active = o.value === range;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => !active && onPick(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                onPick(range === "month" ? "week" : "month");
              }
            }}
            className={cn(
              "flex h-6 items-center rounded-md px-2.5 text-[13px] transition-colors",
              active ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

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
  big = false,
}: {
  day: string;
  today: string;
  muted: boolean;
  big?: boolean;
}) {
  const isToday = day === today;
  const n = Number(day.slice(8, 10));
  const text = n === 1 && !big ? `${Number(day.slice(5, 7))}월 1일` : String(n);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full tabular-nums",
        big ? "size-7 text-base" : "h-6 min-w-6 text-xs",
        text.length > 2 && "w-auto px-1",
        isToday ? "bg-accent font-semibold text-accent-fg" : muted ? "text-muted" : "text-fg",
      )}
    >
      {text}
    </span>
  );
}

/** One week row (month view, or the whole week view on wide screens). */
function WeekRow({ days, items, ctx }: { days: string[]; items: CalendarItem[]; ctx: GridCtx }) {
  const month = ctx.range === "month";
  const layout = layoutWeek(items, days, month ? MONTH_LINES : null);
  const monthKey = ctx.date.slice(0, 7);
  // Bars sit under the day number: month p-1 + h-6 + gap; week header h-12.
  const barTop = month ? 4 + 24 + 2 : 48 + 2;

  return (
    <div role="row" data-cal-week={days.join(",")} className="relative grid grid-cols-7">
      {layout.cells.map((cell, i) => {
        const d = cell.day;
        const outside = month && d.slice(0, 7) !== monthKey;
        const isEmpty = cell.all.length === 0;
        return (
          <div
            key={d}
            role="gridcell"
            data-cal-cell={d}
            tabIndex={d === ctx.focusDay ? 0 : -1}
            aria-current={d === ctx.today ? "date" : undefined}
            aria-label={cellLabel(d, ctx.today, cell.all.length)}
            onFocus={(e) => e.target === e.currentTarget && ctx.onFocusCell(d)}
            onClick={(e) => {
              if (isEmpty && e.target === e.currentTarget) ctx.openAdd(d, e.currentTarget);
            }}
            className={cn(
              "group relative flex min-w-0 flex-col gap-0.5 border-r border-b border-border focus-visible:outline-offset-[-2px]",
              month ? "h-28 p-1" : "min-h-80 p-1",
              outside && "bg-surface",
              ctx.overDay === d && "bg-accent-soft outline-2 -outline-offset-2 outline-accent",
            )}
          >
            {month ? (
              <DayNumber day={d} today={ctx.today} muted={outside} />
            ) : (
              <div
                className="pointer-events-none flex h-12 shrink-0 flex-col items-center justify-center gap-0.5"
                aria-hidden="true"
              >
                <span className="text-xs text-muted">{WEEKDAYS[i]}</span>
                <DayNumber day={d} today={ctx.today} muted={false} big />
              </div>
            )}
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
                size={month ? "month" : "week"}
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
            {month ? (
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
            ) : (
              <button
                type="button"
                data-cal-nav=""
                data-cal-add=""
                tabIndex={-1}
                onClick={(e) => ctx.openAdd(d, e.currentTarget)}
                aria-label={`${shortDay(d)} 마감 할 일 추가`}
                className="mt-auto flex h-6 shrink-0 items-center px-1 text-left text-xs text-muted opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-fg focus-visible:outline-offset-[-2px]"
              >
                ＋ 할 일 추가
              </button>
            )}
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
    item.source === "goal" ? "bg-tone-red-bg" : "bg-tone-gray-bg",
    !bar.continuesBefore && "border-l-2",
    bar.continuesBefore && "rounded-l-none",
    bar.continuesAfter && "rounded-r-none",
  );
  const style = {
    top: top + bar.lane * LANE_PX,
    left: `calc(${(bar.col / 7) * 100}% + 2px)`,
    width: `calc(${(bar.span / 7) * 100}% - 4px)`,
    borderLeftColor: bar.continuesBefore ? undefined : color,
  };
  const body = (
    <>
      {!bar.continuesBefore ? <SourceIcon source={item.source} theme={ctx.theme} /> : null}
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
      <input
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
        className={cn(controlClass, "h-9")}
      />
      {tooLong || error ? (
        <p id={errorId} className="text-xs text-danger">
          {tooLong ? `${TITLE_MAX}자까지 쓸 수 있습니다.` : error}
        </p>
      ) : null}
    </div>
  );
}

function MenuPanel({
  onOpen,
  onMove,
  onDone,
  onTab,
}: {
  onOpen?: () => void;
  onMove: () => void;
  onDone: () => void;
  onTab: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus(), []);
  const entries: { label: string; run: () => void }[] = [
    ...(onOpen ? [{ label: "열기", run: onOpen }] : []),
    { label: "날짜 옮기기…", run: onMove },
    { label: "완료로 표시", run: onDone },
  ];
  return (
    <div
      ref={ref}
      className="flex flex-col"
      onKeyDown={(e) => {
        const buttons = [...(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
        const i = buttons.indexOf(document.activeElement as HTMLElement);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const step = e.key === "ArrowDown" ? 1 : -1;
          buttons[(i + step + buttons.length) % buttons.length]?.focus();
        } else if (e.key === "Tab") onTab();
      }}
    >
      {entries.map((m) => (
        <button
          key={m.label}
          type="button"
          role="menuitem"
          tabIndex={-1}
          onClick={m.run}
          className="flex h-8 items-center rounded-md px-2 text-left text-[13px] text-fg hover:bg-hover focus:bg-hover"
        >
          {m.label}
        </button>
      ))}
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
    <div role="row" className="grid grid-cols-7">
      {days.map((d) => {
        const on = itemsOn(items, d);
        const singles = on.filter((i) => dayOf(i.start) === d && !i.end);
        const bar = on.find((i) => i.end && i.end !== i.start);
        const outside = d.slice(0, 7) !== monthKey;
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
            <span
              className={cn(
                "rounded-full",
                isSelected && d !== ctx.today && "ring-1 ring-border-strong",
              )}
            >
              <DayNumber day={d} today={ctx.today} muted={outside} big={false} />
            </span>
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

function NarrowWeek({ days, items, ctx }: { days: string[]; items: CalendarItem[]; ctx: GridCtx }) {
  return (
    <div className="flex flex-col gap-4">
      {days.map((d, i) => {
        const list = itemsOn(items, d);
        return (
          <section key={d} aria-label={spokenDay(d)} className="flex flex-col">
            <h3 className="flex items-baseline gap-2 text-[13px] font-semibold">
              {shortDay(d)} {WEEKDAYS[i]}
              {d === ctx.today ? (
                <span className="text-xs font-normal text-accent">오늘</span>
              ) : null}
            </h3>
            {list.length ? (
              list.map((item) => (
                <CalendarItemRow
                  key={item.id}
                  item={item}
                  today={ctx.today}
                  theme={ctx.theme}
                  size="list"
                  tabbable
                  handlers={ctx.handlers}
                />
              ))
            ) : (
              <p className="text-xs text-muted">없음</p>
            )}
            <AddButton day={d} ctx={ctx} />
          </section>
        );
      })}
    </div>
  );
}
