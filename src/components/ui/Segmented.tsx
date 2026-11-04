"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";
import { segItem, segTrack } from "./segmented-style";

export type SegmentedOption<T extends string> = {
  value: T;
  /** Accessible name; also the visible text unless `icon` is given. */
  label: string;
  icon?: ReactNode;
};

/**
 * Segmented radio group (`role="radiogroup"`). Icon options show the label as `title`.
 * Arrow keys (←/↑ previous, →/↓ next, wrapping) move and select; only the checked option
 * (or the first, when none is) is in the Tab order. `size="md"` is the larger icon form
 * (h-7 w-8, list view toggle); `fill` stretches the options across the track.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  size = "sm",
  fill = false,
}: {
  options: readonly SegmentedOption<T>[];
  /** `null`: nothing checked yet (e.g. before a stored choice is read on mount). */
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  size?: "sm" | "md";
  fill?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(segTrack, className)}
      onKeyDown={(e) => {
        const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
        if (!back && e.key !== "ArrowRight" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const i = options.findIndex((o) => o.value === value);
        // Nothing checked: ← goes to the last option, → to the first.
        const nextIndex =
          i === -1
            ? back
              ? options.length - 1
              : 0
            : (i + (back ? -1 : 1) + options.length) % options.length;
        const next = options[nextIndex];
        if (!next) return;
        onChange(next.value);
        e.currentTarget
          .querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)
          ?.focus();
      }}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        const focusable = value === null ? i === 0 : active;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            data-value={o.value}
            aria-checked={active}
            aria-label={o.icon ? o.label : undefined}
            title={o.icon ? o.label : undefined}
            tabIndex={focusable ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              segItem(active),
              o.icon ? "px-0" : undefined,
              size === "md" && "h-7 w-8",
              fill && "flex-1",
            )}
          >
            {o.icon ?? o.label}
          </button>
        );
      })}
    </div>
  );
}
