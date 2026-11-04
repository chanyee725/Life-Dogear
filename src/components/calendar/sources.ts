/**
 * How each calendar source looks (docs/PLAN-CALENDAR.md 1절): the graph kind colors
 * (docs/design/graph.md 1.2, same hex as `graph-theme.ts`), Google in gray, plus a shape
 * and a word so color is never the only cue. Pure; safe on server and client.
 */
import type { CSSProperties } from "react";
import type { CalendarSource } from "@/lib/calendar/types";

export type SourceMeta = {
  /** Visible/spoken kind name. */
  label: string;
  /** Shape drawn before the title (aria-hidden). */
  shape: "square" | "diamond" | "triangle" | "circle" | "ring" | "bar";
  light: string;
  dark: string;
};

export const SOURCE_META: Readonly<Record<CalendarSource, SourceMeta>> = {
  task: { label: "할 일", shape: "square", light: "#357339", dark: "#7ec180" },
  project: { label: "프로젝트", shape: "diamond", light: "#6142aa", dark: "#977ee5" },
  seminar: { label: "세미나", shape: "triangle", light: "#038586", dark: "#78d7d6" },
  review: { label: "회고", shape: "bar", light: "#756960", dark: "#8f847c" },
  goal: { label: "목표", shape: "bar", light: "#cc3430", dark: "#f27166" },
  paper: { label: "논문", shape: "circle", light: "#348dcf", dark: "#75bffc" },
  // Graph `neutral` gray (light) / tag-ish cool gray (dark).
  google: { label: "Google", shape: "ring", light: "#71747c", dark: "#9a9da5" },
};

/** CSS variables the calendar classes read (`text-(--cal-c)`, `bg-(--cal-c)`). */
export function sourceStyle(source: CalendarSource): CSSProperties {
  const m = SOURCE_META[source];
  return { "--cal-l": m.light, "--cal-d": m.dark } as CSSProperties;
}

/** Text/border/background color classes driven by `sourceStyle`. */
export const SOURCE_TEXT = "text-(--cal-l) dark:text-(--cal-d)";
export const SOURCE_BG = "bg-(--cal-l) dark:bg-(--cal-d)";
export const SOURCE_BORDER = "border-(--cal-l) dark:border-(--cal-d)";
