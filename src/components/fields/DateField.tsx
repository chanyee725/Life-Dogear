"use client";

import type { InputHTMLAttributes } from "react";
import { controlClass } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";

export type DateFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  /** `YYYY-MM-DD`, or "" / null for empty. */
  value?: string | null;
  defaultValue?: string | null;
  /** Receives `YYYY-MM-DD`, or "" when cleared. */
  onChange?: (value: string) => void;
};

/** Native date picker that speaks plain `YYYY-MM-DD` strings. */
export function DateField({ value, defaultValue, onChange, className, ...props }: DateFieldProps) {
  const controlled = value !== undefined;
  return (
    <input
      type="date"
      {...(controlled ? { value: value ?? "" } : { defaultValue: defaultValue ?? "" })}
      onChange={(e) => onChange?.(e.target.value)}
      className={cn(controlClass, "h-9 w-auto min-w-40 tabular-nums", className)}
      {...props}
    />
  );
}
