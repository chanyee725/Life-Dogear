"use client";

import { useId, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { filterChipClass } from "@/components/list/TagFilter";
import { cn } from "@/components/ui";

export type ProjectTab = "research" | "general";

const STORAGE_KEY = "rb-home-projects-tab";
const ORDER: ProjectTab[] = ["research", "general"];
const LABELS: Record<ProjectTab, string> = { research: "연구 칸반", general: "그 외" };

// The remembered tab lives in localStorage. Reading it through useSyncExternalStore
// lets the client pick it up during hydration (the server renders the default), so
// the switch happens before the first paint instead of after an effect.
const listeners = new Set<() => void>();

function readTab(): ProjectTab {
  try {
    return localStorage.getItem(STORAGE_KEY) === "general" ? "general" : "research";
  } catch {
    return "research";
  }
}

function writeTab(tab: ProjectTab) {
  try {
    localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    // Not remembered; the in-memory listeners still update.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Tabs for the home "진행 중인 프로젝트" section. Both panels are rendered on the
 * server and passed in; the last choice is remembered.
 * Keys: ←/→ move to the previous/next tab, Home/End to the first/last.
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
  const tab = useSyncExternalStore(subscribe, readTab, () => "research" as const);
  const id = useId();

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = ORDER.indexOf(tab);
    const target =
      event.key === "ArrowRight"
        ? ORDER[(index + 1) % ORDER.length]
        : event.key === "ArrowLeft"
          ? ORDER[(index - 1 + ORDER.length) % ORDER.length]
          : event.key === "Home"
            ? ORDER[0]
            : event.key === "End"
              ? ORDER[ORDER.length - 1]
              : null;
    if (!target) return;
    event.preventDefault();
    writeTab(target);
    document.getElementById(`${id}-${target}-tab`)?.focus();
  }

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
              onClick={() => writeTab(value)}
              onKeyDown={onKeyDown}
              className={filterChipClass(active)}
            >
              {LABELS[value]}
              <span
                className={cn(
                  "text-xs font-normal tabular-nums",
                  active ? "text-accent/80" : "text-muted",
                )}
              >
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
          tabIndex={0}
          hidden={tab !== value}
          className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {value === "research" ? research : general}
        </div>
      ))}
    </div>
  );
}
