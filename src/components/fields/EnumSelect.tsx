"use client";

import type { SelectHTMLAttributes } from "react";
import { Select, type ControlSize } from "@/components/ui/Input";

export type EnumOption<V extends string = string> = { value: V; label: string };

export type EnumSelectProps<V extends string> = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "defaultValue" | "onChange" | "size"
> & {
  size?: ControlSize;
  options: readonly EnumOption<V>[];
  value?: V | "";
  defaultValue?: V | "";
  onChange?: (value: V | "") => void;
  /** Adds a first option with an empty value (e.g. "전체" for filters). */
  emptyLabel?: string;
};

/** Select over a fixed set of enum values with Korean labels. */
export function EnumSelect<V extends string>({
  options,
  value,
  defaultValue,
  onChange,
  emptyLabel,
  ...props
}: EnumSelectProps<V>) {
  const controlled = value !== undefined;
  return (
    <Select
      {...(controlled ? { value } : { defaultValue })}
      onChange={(e) => onChange?.(e.target.value as V | "")}
      {...props}
    >
      {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
