/**
 * Calendar sources (calendar.md 2절): name, order and default visibility, plus the stored
 * "표시" choice (`localStorage` `rb-calendar-sources`). Colors come from the graph theme
 * (`SourceIcon`). Pure; safe on server and client.
 */
import type { CalendarItem, CalendarSource, GoogleStatus } from "@/lib/calendar/types";

export const SOURCE_LABEL: Readonly<Record<CalendarSource, string>> = {
  task: "할 일",
  project: "프로젝트",
  seminar: "세미나",
  goal: "분기 목표",
  review: "회고",
  paper: "논문",
  google: "Google 일정",
};

/** Popover order (= the table in 2절). */
export const SOURCES: readonly CalendarSource[] = [
  "task",
  "project",
  "seminar",
  "goal",
  "review",
  "paper",
  "google",
];

export const SOURCES_KEY = "rb-calendar-sources";

export type SourceChoice = Readonly<Record<CalendarSource, boolean>>;

/** Papers (last read day) start off; everything else on. */
export const DEFAULT_SOURCES: SourceChoice = {
  task: true,
  project: true,
  seminar: true,
  goal: true,
  review: true,
  paper: false,
  google: true,
};

/** Stored JSON → choice; unknown or broken values fall back to the defaults per key. */
export function parseSources(raw: string | null): SourceChoice {
  if (!raw) return DEFAULT_SOURCES;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return DEFAULT_SOURCES;
    const out = { ...DEFAULT_SOURCES };
    for (const s of SOURCES) {
      const v = (value as Record<string, unknown>)[s];
      if (typeof v === "boolean") out[s] = v;
    }
    return out;
  } catch {
    return DEFAULT_SOURCES;
  }
}

/** Items the user chose to see (Google only when it is set up). */
export function visibleItems(
  items: readonly CalendarItem[],
  choice: SourceChoice,
  google: GoogleStatus,
): CalendarItem[] {
  return items.filter((it) => choice[it.source] && (it.source !== "google" || google !== "off"));
}

export const noneChosen = (choice: SourceChoice, google: GoogleStatus) =>
  SOURCES.every((s) => !choice[s] || (s === "google" && google === "off"));
