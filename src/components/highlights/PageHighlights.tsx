import { HIGHLIGHT_FILL, type HighlightColor, type RatioRect } from "@/lib/highlights";

export type OverlayHighlight = {
  id: string;
  color: HighlightColor;
  rects: RatioRect[];
  note: string;
};

const pct = (n: number) => `${n * 100}%`;

/**
 * Highlights of one page, drawn over the page. Positions are page fractions, so
 * they follow zoom without recalculation. Pointer events pass through so the
 * text underneath stays selectable.
 */
export function PageHighlights({
  items,
  activeId,
}: {
  items: OverlayHighlight[];
  /** Briefly outlined (just jumped to from the list). */
  activeId?: string | null;
}) {
  if (!items.length) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[3]">
      {items.flatMap((h) =>
        h.rects.map((r, i) => (
          <div
            key={`${h.id}-${i}`}
            className={
              h.id === activeId
                ? "absolute rounded-[2px] outline-2 outline-offset-1 outline-accent"
                : "absolute rounded-[2px]"
            }
            style={{
              left: pct(r.x),
              top: pct(r.y),
              width: pct(r.w),
              height: pct(r.h),
              background: HIGHLIGHT_FILL[h.color],
              mixBlendMode: "multiply",
            }}
          />
        )),
      )}
    </div>
  );
}
