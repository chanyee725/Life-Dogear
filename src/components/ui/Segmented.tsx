"use client";

import type { ReactNode } from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "./cn";
import { RadioGroup } from "./primitives/radio-group";
import { segItem, segTrack } from "./segmented-style";

export type SegmentedOption<T extends string> = {
  value: T;
  /** Accessible name; also the visible text unless `icon` is given. */
  label: string;
  icon?: ReactNode;
};

/**
 * Segmented radio group (Radix RadioGroup: `role="radiogroup"`). Icon options show the
 * label as `title`. Arrow keys (←/↑ previous, →/↓ next, wrapping) move and select; only the
 * checked option is in the Tab order. `size="md"` is the larger icon form (h-7 w-8, list
 * view toggle); `fill` stretches the options across the track.
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
    <RadioGroup
      aria-label={ariaLabel}
      // "" checks nothing (Radix needs a controlled string).
      value={value ?? ""}
      onValueChange={(next) => onChange(next as T)}
      loop
      className={cn(segTrack, className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <RadioGroupPrimitive.Item
            key={o.value}
            value={o.value}
            data-value={o.value}
            aria-label={o.icon ? o.label : undefined}
            title={o.icon ? o.label : undefined}
            className={cn(
              segItem(active),
              o.icon ? "px-0" : undefined,
              size === "md" && "h-7 w-8",
              fill && "flex-1",
            )}
          >
            {o.icon ?? o.label}
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroup>
  );
}
