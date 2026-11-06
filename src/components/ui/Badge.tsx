import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export const BADGE_TONES = [
  "gray",
  "blue",
  "green",
  "amber",
  "red",
  "violet",
  "teal",
  "rose",
  "orange",
] as const;
export type BadgeTone = (typeof BADGE_TONES)[number];

const toneClass: Record<BadgeTone, string> = {
  gray: "bg-tone-gray-bg text-tone-gray-fg",
  blue: "bg-tone-blue-bg text-tone-blue-fg",
  green: "bg-tone-green-bg text-tone-green-fg",
  amber: "bg-tone-amber-bg text-tone-amber-fg",
  red: "bg-tone-red-bg text-tone-red-fg",
  violet: "bg-tone-violet-bg text-tone-violet-fg",
  teal: "bg-tone-teal-bg text-tone-teal-fg",
  rose: "bg-tone-rose-bg text-tone-rose-fg",
  orange: "bg-tone-orange-bg text-tone-orange-fg",
};

function isTone(value: string): value is BadgeTone {
  return (BADGE_TONES as readonly string[]).includes(value);
}

/** Quiet status/kind badge. `tone` is a plain string; unknown tones fall back to gray. */
export function Badge({
  tone = "gray",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: string }) {
  const resolved = isTone(tone) ? tone : "gray";
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-md border border-transparent px-2 text-xs leading-none font-medium whitespace-nowrap [&>svg]:size-3",
        toneClass[resolved],
        className,
      )}
      {...props}
    />
  );
}

/** Small neutral tag chip (e.g. `#태그`). */
export function TagChip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit max-w-[9rem] min-w-0 items-center gap-1 truncate rounded-md border border-border bg-transparent px-1.5 text-xs leading-none text-muted-foreground whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}
