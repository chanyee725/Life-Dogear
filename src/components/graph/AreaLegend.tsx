"use client";

/**
 * Area legend for the basic graph colored by area (design 1.3): bottom left above the
 * search hint. One row per area that has nodes on screen, in palette order, then "영역 없음".
 * A row sets the area filter (pressed again: clears it).
 */
import { cn } from "@/components/ui/cn";
import { slotColor } from "@/lib/graph/color";
import type { GraphTheme } from "./graph-theme";

export type AreaLegendRow = { id: string; title: string; slot: number };

export function AreaLegend({
  areas,
  hasNeutral,
  activeArea,
  theme,
  onPick,
}: {
  /** Areas on screen, in slot order. */
  areas: readonly AreaLegendRow[];
  hasNeutral: boolean;
  activeArea: string | undefined;
  theme: GraphTheme;
  onPick: (areaId: string | undefined) => void;
}) {
  if (areas.length === 0 && !hasNeutral) return null;
  const swatch = (color: string) => (
    <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: color }} />
  );
  return (
    <div
      role="group"
      aria-label="영역 범례"
      className="absolute bottom-11 left-4 flex max-h-[40%] flex-col gap-1 overflow-auto rounded-lg border border-border bg-bg/95 px-3 py-2 text-xs text-fg"
    >
      {areas.map((a) => {
        const on = activeArea === a.id;
        return (
          <button
            key={a.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? undefined : a.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm text-left hover:text-fg",
              on ? "font-medium" : "text-fg",
            )}
          >
            {swatch(slotColor(a.slot, theme.area, theme.neutral))}
            <span className="max-w-40 truncate">{a.title}</span>
          </button>
        );
      })}
      {hasNeutral ? (
        <span className="inline-flex items-center gap-1.5 text-muted">
          {swatch(theme.neutral)}
          영역 없음
        </span>
      ) : null}
    </div>
  );
}
