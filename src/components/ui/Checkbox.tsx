"use client";

import type { ComponentProps } from "react";
import { cn } from "./cn";
import { Checkbox as CheckboxPrimitive } from "./primitives/checkbox";

/**
 * Radix checkbox (`role="checkbox"` button). Name it with `aria-label`, or wrap it in a
 * `<label>` with the text. `onCheckedChange` gets a plain boolean.
 */
export function Checkbox({
  onCheckedChange,
  className,
  ...props
}: Omit<ComponentProps<typeof CheckboxPrimitive>, "checked" | "onCheckedChange"> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <CheckboxPrimitive
      onCheckedChange={(v) => onCheckedChange?.(v === true)}
      className={cn("border-border-strong bg-bg", className)}
      {...props}
    />
  );
}
