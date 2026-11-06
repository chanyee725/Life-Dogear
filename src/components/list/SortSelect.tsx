"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Input";
import { buildHref, type QueryParams } from "./query";

/**
 * Dropdown that navigates to `?<param>=<value>` (default `sort`), keeping other params.
 * `label` shows a quiet word before the select (e.g. "묶기") and names it for screen readers.
 */
export function SortSelect({
  options,
  value,
  basePath,
  params = {},
  param = "sort",
  label,
}: {
  options: readonly { value: string; label: string }[];
  value: string;
  basePath: string;
  params?: QueryParams;
  param?: string;
  label?: string;
}) {
  const router = useRouter();
  const select = (
    <Select
      aria-label={label ?? "정렬"}
      value={value}
      onChange={(e) => router.push(buildHref(basePath, params, { [param]: e.target.value }))}
      className="h-8 w-auto py-0 text-[13px] leading-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
  if (!label) return select;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span aria-hidden>{label}</span>
      {select}
    </span>
  );
}
