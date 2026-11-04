"use client";

import { ShapeIcon } from "@/components/graph/ShapeIcon";
import type { GraphTheme } from "@/components/graph/graph-theme";
import type { CalendarSource } from "@/lib/calendar/types";

/** Source color: graph kind colors; Google events in Google blue. */
export const GOOGLE_BLUE = { light: "#1a73e8", dark: "#8ab4f8" };
export const sourceColor = (theme: GraphTheme, source: CalendarSource) =>
  source === "google" ? (theme.dark ? GOOGLE_BLUE.dark : GOOGLE_BLUE.light) : theme.kind[source];

/** Soft tint of a source color for chip and row backgrounds. */
export const sourceTint = (theme: GraphTheme, source: CalendarSource, pct = 14) =>
  `color-mix(in oklch, ${sourceColor(theme, source)} ${pct}%, transparent)`;

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
  theme,
}: {
  source: CalendarSource;
  hollow: boolean;
  theme: GraphTheme;
}) {
  const color = sourceColor(theme, source);
  return (
    <span
      aria-hidden="true"
      className="size-1 rounded-full"
      style={hollow ? { boxShadow: `inset 0 0 0 1px ${color}` } : { backgroundColor: color }}
    />
  );
}
