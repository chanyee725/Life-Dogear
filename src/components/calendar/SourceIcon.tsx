"use client";

import { ShapeIcon } from "@/components/graph/ShapeIcon";
import type { GraphTheme } from "@/components/graph/graph-theme";
import type { CalendarSource } from "@/lib/calendar/types";

/** Source color: graph kind colors; personal (Google) events in a deep orange. */
export const PERSONAL_ORANGE = { light: "#d9480f", dark: "#ff8a4c" };
export const sourceColor = (theme: GraphTheme, source: CalendarSource) =>
  source === "google"
    ? theme.dark
      ? PERSONAL_ORANGE.dark
      : PERSONAL_ORANGE.light
    : theme.kind[source];

/**
 * Calendar event palette (globals.css `--rb-ev-<source>-*`): one soft bg, a same-hue
 * text color and a mid dot per source, shared by chips, bars and dots on home, /tasks
 * and the week strips. Kept apart from the graph kind colors (list icons) on purpose.
 */
export const eventBg = (source: CalendarSource) => `var(--rb-ev-${source}-bg)`;
export const eventFg = (source: CalendarSource) => `var(--rb-ev-${source}-fg)`;
export const eventDot = (source: CalendarSource) => `var(--rb-ev-${source}-dot)`;

/**
 * 10×10 source icon (aria-hidden; labels carry the meaning): the graph shapes, a filled
 * square at 0.45 for done tasks, and a 2×10 vertical bar for Google.
 */
export function SourceIcon({
  source,
  done = false,
  theme,
  className = "shrink-0",
}: {
  source: CalendarSource;
  done?: boolean;
  theme: GraphTheme;
  className?: string;
}) {
  const color = sourceColor(theme, source);
  if (source === "google") {
    return (
      <svg className={className} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <rect x="4" y="0" width="2" height="10" rx="1" fill={color} />
      </svg>
    );
  }
  if (source === "task" && done) {
    return (
      <svg className={className} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <rect x="1.6" y="1.6" width="6.8" height="6.8" rx="1" fill={color} opacity="0.45" />
      </svg>
    );
  }
  return (
    <ShapeIcon
      type={source}
      horizon={source === "goal" ? "quarter" : undefined}
      theme={theme}
      color={color}
      quarterFill={theme.goalSoft}
      className={className}
    />
  );
}

/** 4×4 dot (8절·9절); `hollow` = only done tasks that day. */
export function SourceDot({
  source,
  hollow,
}: {
  source: CalendarSource;
  hollow: boolean;
}) {
  const color = eventDot(source);
  return (
    <span
      aria-hidden="true"
      className="size-1 rounded-full"
      style={hollow ? { boxShadow: `inset 0 0 0 1px ${color}` } : { backgroundColor: color }}
    />
  );
}
