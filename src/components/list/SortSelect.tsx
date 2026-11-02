"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Input";
import { buildHref, type QueryParams } from "./query";

/** Sort dropdown that navigates to `?sort=<value>`, keeping other params. */
export function SortSelect({
  options,
  value,
  basePath,
  params = {},
}: {
  options: readonly { value: string; label: string }[];
  value: string;
  basePath: string;
  params?: QueryParams;
}) {
  const router = useRouter();
  return (
    <Select
      aria-label="정렬"
      value={value}
      onChange={(e) => router.push(buildHref(basePath, params, { sort: e.target.value }))}
      className="h-8 w-auto text-[13px]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
