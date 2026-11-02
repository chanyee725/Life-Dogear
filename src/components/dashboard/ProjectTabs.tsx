"use client";

import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/components/ui";

export type ProjectTab = "research" | "general";

const STORAGE_KEY = "rb-home-projects-tab";
const ORDER: ProjectTab[] = ["research", "general"];

/**
 * Tabs for the home "진행 중인 프로젝트" section. Both panels are rendered on the
 * server and passed in; the last choice is remembered in localStorage.
 */
export function ProjectTabs({
  research,
  general,
  counts,
}: {
  research: ReactNode;
  general: ReactNode;
  counts: Record<ProjectTab, number>;
}) {
  const [tab, setTab] = useState<ProjectTab>("research");
  const id = useId();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "research" || saved === "general") setTab(saved);
    } catch {
      // Storage unavailable: keep the default.
    }
  }, []);

  function select(next: ProjectTab) {
    setTab(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered; fine.
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = ORDER[(ORDER.indexOf(tab) + 1) % ORDER.length];
    select(next);
    document.getElementById(`${id}-${next}-tab`)?.focus();
  }

  const labels: Record<ProjectTab, string> = { research: "연구 칸반", general: "그 외" };

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="프로젝트 보기" className="flex gap-1">
        {ORDER.map((value) => {
          const active = tab === value;
          return (
            <button
              key={value}
              id={`${id}-${value}-tab`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`${id}-${value}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => select(value)}
              onKeyDown={onKeyDown}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[13px] transition-colors",
                active ? "bg-fg text-bg" : "text-muted hover:bg-hover hover:text-fg",
              )}
            >
              {labels[value]}
              <span className={cn("text-xs tabular-nums", active ? "text-bg/70" : "text-faint")}>
                {counts[value]}
              </span>
            </button>
          );
        })}
      </div>
      {ORDER.map((value) => (
        <div
          key={value}
          id={`${id}-${value}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${value}-tab`}
          hidden={tab !== value}
        >
          {value === "research" ? research : general}
        </div>
      ))}
    </div>
  );
}
