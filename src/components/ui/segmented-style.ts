import { cn } from "./cn";

/** Shared look of segmented controls: a subtle track with a raised checked option. */
export const segTrack = "flex gap-0.5 rounded-lg bg-subtle p-0.5";
export const segItem = (active: boolean) =>
  cn(
    "flex h-6 items-center justify-center rounded-md px-2.5 text-[13px] transition-colors",
    active ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg",
  );

/**
 * Option index an arrow key moves to in a segmented radio group: ←/↑ previous, →/↓ next,
 * wrapping. With nothing checked (`index === -1`) ← goes to the last option, → to the
 * first. `null` for other keys (or no options).
 */
export function segmentedNextIndex(index: number, length: number, key: string): number | null {
  const back = key === "ArrowLeft" || key === "ArrowUp";
  if (length === 0 || (!back && key !== "ArrowRight" && key !== "ArrowDown")) return null;
  if (index === -1) return back ? length - 1 : 0;
  return (index + (back ? -1 : 1) + length) % length;
}
