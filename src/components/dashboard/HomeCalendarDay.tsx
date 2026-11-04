"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { CalendarView, type CalendarViewProps } from "@/components/calendar/CalendarView";
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

/** The home calendar, reporting its selected day to the provider. */
export function HomeCalendarView(props: Omit<CalendarViewProps, "onSelectDay">) {
  const { setDay } = useDay();
  return <CalendarView {...props} onSelectDay={setDay} />;
}

/** 할 일 추가 in the today panel: due on the day selected in the calendar. */
export function HomeTaskInput({ today }: { today: string }) {
  const { day } = useDay();
  return <TaskQuickInput day={day} today={today} />;
}
