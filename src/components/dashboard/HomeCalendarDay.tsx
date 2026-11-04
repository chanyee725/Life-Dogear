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
 * The home calendar, reporting its selected day to the provider. `data` is the server's
 * unawaited promise: the grid draws empty at once and fills when it settles (a refresh hands
 * a new promise; the old items stay until it settles). No Suspense, so nothing in the block —
 * the inputs above all — is ever swapped out.
 */
export function HomeCalendarView({
  data,
  ...props
}: Omit<CalendarViewProps, "onSelectDay" | "items" | "google" | "failed"> & {
  data: Promise<HomeCalendarData>;
}) {
  const { setDay } = useDay();
  const [loaded, setLoaded] = useState<HomeCalendarData>(EMPTY);
  useEffect(() => {
    let live = true;
    void data.then((d) => {
      if (live) setLoaded(d);
    });
    return () => {
      live = false;
    };
  }, [data]);
  return (
    <CalendarView
      {...props}
      items={loaded.items}
      google={loaded.google}
      failed={loaded.failed}
      onSelectDay={setDay}
    />
  );
}

const EMPTY: HomeCalendarData = { items: [], google: "off", failed: false };

/** 할 일 추가 in the today panel: due on the day selected in the calendar. */
export function HomeTaskInput({ today }: { today: string }) {
  const { day } = useDay();
  return <TaskQuickInput day={day} today={today} />;
}
