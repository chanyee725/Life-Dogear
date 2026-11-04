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
 * ←/→ move and select; only the checked option (or the first, when none is) is in the Tab order.
 * `itemClassName` sizes the options (e.g. `h-7 w-8` for the list view toggle).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  itemClassName,
}: {
  options: readonly SegmentedOption<T>[];
  /** `null`: nothing checked yet (e.g. before a stored choice is read on mount). */
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(segTrack, className)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const i = options.findIndex((o) => o.value === value);
        const step = e.key === "ArrowRight" ? 1 : -1;
        const next = options[(i + step + options.length) % options.length];
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
            className={cn(segItem(active), o.icon ? "px-0" : undefined, itemClassName)}
          >
            {o.icon ?? o.label}
          </button>
        );
      })}
    </div>
  );
}
