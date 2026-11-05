"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CalendarView, type CalendarViewProps } from "@/components/calendar/CalendarView";
import { Popover } from "@/components/calendar/Popover";
import { PlusIcon } from "@/components/shell/icons";
import { QUICK_ADD_EVENT, QUICK_INPUT_ID } from "@/components/shell/shortcuts";
import { Button, cn } from "@/components/ui";
import type { CalendarResult } from "@/lib/calendar/types";
import { QuickInput, TaskQuickInput } from "./QuickInput";
import { Tooltip } from "@/components/ui/Tooltip";

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
}: Omit<CalendarViewProps, "onSelectDay" | "items" | "google" | "googleWrite" | "failed"> & {
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
        googleWrite={current.googleWrite}
        failed={current.failed}
        loading={!loaded}
        gridTestId="home-calendar-grid"
        dayList={false}
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
 * two titled sections: 할 일 (할 일 추가, due on the day selected in the calendar) over 생각
 * (생각 추가, saved to the inbox). Opening focuses the
 * first input, `/` (QUICK_ADD_EVENT) opens it on 생각 추가. Esc and outside presses close
 * it; focus goes back to the button unless the press moved it somewhere else. Once opened
 * it stays mounted and is only hidden, so typed text and the saved / error lines survive.
 */
export function HomeQuickAdd({ today }: { today: string }) {
  const { day } = useDay();
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Bumped by `/`: focus 생각 추가 once the popover is shown (it may be open already).
  const [thoughtFocus, setThoughtFocus] = useState(0);

  const show = () => {
    setMounted(true);
    setOpen(true);
  };

  useEffect(() => {
    const onOpen = (e: Event) => {
      e.preventDefault();
      show();
      setThoughtFocus((n) => n + 1);
    };
    window.addEventListener(QUICK_ADD_EVENT, onOpen);
    return () => window.removeEventListener(QUICK_ADD_EVENT, onOpen);
  }, []);

  // Runs after Popover's own effect (which focuses the first input, 할 일 추가).
  useEffect(() => {
    if (thoughtFocus) document.getElementById(QUICK_INPUT_ID)?.focus();
  }, [thoughtFocus]);

  const close = (refocus: boolean) => {
    setOpen(false);
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
      <Tooltip content="빠른 추가 (/)" side="bottom">
        <Button
          ref={buttonRef}
          variant="secondary"
          size="icon"
          className="size-7"
          aria-label="빠른 추가"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={mounted ? id : undefined}
          onClick={() => (open ? close(true) : show())}
        >
          <PlusIcon />
        </Button>
      </Tooltip>
      {mounted ? (
        <Popover
          id={id}
          anchor={buttonRef.current}
          onClose={close}
          label="빠른 추가"
          align="end"
          hidden={!open}
          className="w-72 max-w-[calc(100vw-1rem)] p-3"
        >
          {/* Layout on an inner box: a display class on the root would beat `hidden`. */}
          <div className="flex flex-col gap-3">
            <QuickAddSection title="할 일">
              <TaskQuickInput day={day} today={today} />
            </QuickAddSection>
            <QuickAddSection title="생각" className="border-t border-border pt-3">
              <QuickInput />
            </QuickAddSection>
          </div>
        </Popover>
      ) : null}
    </>
  );
}

/** A titled group in 빠른 추가 (할 일 / 생각). */
function QuickAddSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-1.5", className)}>
      <h3 id={id} className="text-xs font-medium text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}
