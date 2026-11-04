"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { CalendarView, type CalendarViewProps } from "@/components/calendar/CalendarView";
import type { CalendarResult } from "@/lib/calendar/types";
import { TaskQuickInput } from "./QuickInput";

/** The day selected in the home calendar, shared with the 할 일 추가 input in its panel. */
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
 * first one settles the block is `aria-busy` and the panel says so above "다음 일정". No
 * Suspense, so nothing in the block — the inputs above all — is ever swapped out.
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
    <section aria-label="달력" aria-busy={loaded ? undefined : true}>
      <CalendarView
        {...props}
        items={current.items}
        google={current.google}
        failed={current.failed}
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

/** 할 일 추가 in the today panel: due on the day selected in the calendar. */
export function HomeTaskInput({ today }: { today: string }) {
  const { day } = useDay();
  return <TaskQuickInput day={day} today={today} />;
}
