"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarView, type CalendarViewProps } from "@/components/calendar/CalendarView";
import { Popover } from "@/components/calendar/Popover";
import { PlusIcon } from "@/components/shell/icons";
import { QUICK_ADD_EVENT } from "@/components/shell/shortcuts";
import { Button } from "@/components/ui";
import type { CalendarResult } from "@/lib/calendar/types";
import { QuickInput, TaskQuickInput } from "./QuickInput";

/** The day selected in the home calendar, shared with the 할 일 추가 input in 빠른 추가. */
const DayContext = createContext<{ day: string; setDay: (day: string) => void } | null>(null);

function useDay() {
  const ctx = useContext(DayContext);
  if (!ctx) throw new Error("HomeDayProvider missing");
  return ctx;
}

/** Holds the selected day (starts on today) for the home calendar block. */
export function HomeDayProvider({ today, children }: { today: string; children: ReactNode }) {
  const [day, setDay] = useState(today);
  return <DayContext.Provider value={{ day, setDay }}>{children}</DayContext.Provider>;
}

export type HomeCalendarData = CalendarResult & { failed: boolean };

/**
 * The home calendar block (`section` "달력"), reporting its selected day to the provider.
 * `data` is the server's unawaited promise: the grid draws empty at once and fills when it
 * settles (a refresh hands a new promise; the old items stay until it settles). Until the
 * first one settles CalendarView is `loading` (grid `aria-busy`, "다음 일정 …") and the
 * panel says "일정 불러오는 중…".
 * No Suspense, so nothing in the block — 빠른 추가 and its inputs above all — is swapped out.
 */
export function HomeCalendarView({
  data,
  panelSlot,
  ...props
}: Omit<CalendarViewProps, "onSelectDay" | "items" | "google" | "failed"> & {
  data: Promise<HomeCalendarData>;
}) {
  const { setDay } = useDay();
  const [loaded, setLoaded] = useState<HomeCalendarData | null>(null);
  useEffect(() => {
    let live = true;
    void data.then((d) => {
      if (live) setLoaded(d);
    });
    return () => {
      live = false;
    };
  }, [data]);
  const current = loaded ?? EMPTY;
  return (
    <section aria-label="달력">
      <CalendarView
        {...props}
        items={current.items}
        google={current.google}
        failed={current.failed}
        loading={!loaded}
        gridTestId="home-calendar-grid"
        onSelectDay={setDay}
        panelSlot={
          <>
            {panelSlot}
            {loaded ? null : (
              <p role="status" className="text-xs text-muted">
                일정 불러오는 중…
              </p>
            )}
          </>
        }
      />
    </section>
  );
}

const EMPTY: HomeCalendarData = { items: [], google: "off", failed: false };

/**
 * 빠른 추가: a + button at the right of the calendar toolbar opening a small popover with
 * 할 일 추가 (due on the day selected in the calendar) over 생각 추가. Opening focuses the
 * first input, `/` (QUICK_ADD_EVENT) opens it on 생각 추가. Esc and outside presses close
 * it; focus goes back to the button unless the press moved it somewhere else.
 */
export function HomeQuickAdd({ today }: { today: string }) {
  const { day } = useDay();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<null | "task" | "thought">(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      e.preventDefault();
      setOpen("thought");
    };
    window.addEventListener(QUICK_ADD_EVENT, onOpen);
    return () => window.removeEventListener(QUICK_ADD_EVENT, onOpen);
  }, []);

  const close = (refocus: boolean) => {
    setOpen(null);
    const button = buttonRef.current;
    if (refocus) button?.focus();
    // Outside press: refocus only if it left focus nowhere (not on a link or field).
    else
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || active === document.body) button?.focus();
      });
  };

  return (
    <>
      <Button
        ref={buttonRef}
        variant="secondary"
        size="icon"
        className="size-7"
        aria-label="빠른 추가"
        title="빠른 추가 (/)"
        aria-haspopup="dialog"
        aria-expanded={open !== null}
        onClick={() => (open ? close(true) : setOpen("task"))}
      >
        <PlusIcon />
      </Button>
      {open ? (
        <Popover
          anchor={buttonRef.current}
          onClose={close}
          label="빠른 추가"
          className="flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-1 p-3"
        >
          <TaskQuickInput day={day} today={today} autoFocus={open === "task"} />
          <QuickInput autoFocus={open === "thought"} />
        </Popover>
      ) : null}
    </>
  );
}
