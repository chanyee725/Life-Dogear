"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reorderAreas } from "@/app/_actions/areas";
import { safeAction } from "@/components/links/safe-action";
import { cn } from "@/components/ui/cn";

export type AreaRow = { id: string; title: string; standard: string; projectCount: number };

/** Area list in sidebar order, with 위로/아래로 buttons to reorder. */
export function AreaOrderList({ areas }: { areas: AreaRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(areas);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    const previous = rows;
    setRows(next);
    setError(null);
    startTransition(async () => {
      const result = await safeAction(() => reorderAreas(next.map((r) => r.id)));
      if (!result.ok) {
        setRows(previous);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const arrow =
    "flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg disabled:opacity-30";

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {rows.map((area, i) => (
          <li
            key={area.id}
            className={cn("flex items-center gap-3 px-3 py-2.5", pending && "opacity-80")}
          >
            <Link href={`/areas/${area.id}`} className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium hover:underline">
                {area.title}
              </span>
              {area.standard ? (
                <span className="block truncate text-[13px] text-muted">{area.standard}</span>
              ) : null}
            </Link>
            <span className="text-xs text-muted tabular-nums">프로젝트 {area.projectCount}</span>
            <button
              type="button"
              className={arrow}
              aria-label={`${area.title} 위로`}
              disabled={pending || i === 0}
              onClick={() => move(i, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className={arrow}
              aria-label={`${area.title} 아래로`}
              disabled={pending || i === rows.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
