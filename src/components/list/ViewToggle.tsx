"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export type ViewMode = "table" | "cards";

const storageKey = (key: string) => `rb-view:${key}`;

/** Table/card choice remembered per list in localStorage. Starts at `fallback` until mounted. */
export function useViewMode(
  key: string,
  fallback: ViewMode = "table",
): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setModeState] = useState<ViewMode>(fallback);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(key));
      if (saved === "table" || saved === "cards") setModeState(saved);
    } catch {
      // Storage unavailable: keep the fallback.
    }
  }, [key]);

  const setMode = useCallback(
    (next: ViewMode) => {
      setModeState(next);
      try {
        localStorage.setItem(storageKey(key), next);
      } catch {
        // Ignore: the choice just isn't remembered.
      }
    },
    [key],
  );

  return [mode, setMode];
}

const OPTIONS: { value: ViewMode; label: string; icon: ReactNode }[] = [
  {
    value: "table",
    label: "표 보기",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        aria-hidden="true"
      >
        <path d="M2 3.5h12M2 8h12M2 12.5h12" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "cards",
    label: "카드 보기",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="5" height="5" rx="1" />
        <rect x="9" y="2" width="5" height="5" rx="1" />
        <rect x="2" y="9" width="5" height="5" rx="1" />
        <rect x="9" y="9" width="5" height="5" rx="1" />
      </svg>
    ),
  },
];

export function ViewToggle({
  value,
  onChange,
  className,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="보기 방식"
      className={cn("flex gap-0.5 rounded-lg bg-subtle p-0.5", className)}
    >
      {OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-7 w-8 items-center justify-center rounded-md transition-colors",
              active ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            {o.icon}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Client switch between two server-rendered views. Pass both as ReactNode so
 * server pages can keep their render logic (no functions cross the client boundary).
 */
export function ListView({
  storageKey: key,
  table,
  cards,
  toolbar,
  className,
}: {
  /** Per-list key, e.g. "papers". */
  storageKey: string;
  table: ReactNode;
  cards: ReactNode;
  /** Filters etc., shown left of the toggle. */
  toolbar?: ReactNode;
  className?: string;
}) {
  const [mode, setMode] = useViewMode(key);
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* items-start: the toggle lines up with the first toolbar row (sort select), not the block's middle. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        <ViewToggle value={mode} onChange={setMode} />
      </div>
      {mode === "table" ? table : cards}
    </div>
  );
}
