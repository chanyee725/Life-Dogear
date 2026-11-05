"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  applyAccent,
  readAccentPreference,
  saveAccentPreference,
  type AccentPreference,
} from "./accent";

// Swatches show the light-theme accent of each option, so the dot reads the same in
// either theme (the dot is a sample, not the live token).
const OPTIONS: { value: AccentPreference; label: string; swatch: string }[] = [
  { value: "blue", label: "파랑", swatch: "#4f5bd5" },
  { value: "terracotta", label: "테라코타", swatch: "#b8461a" },
  { value: "mono", label: "모노", swatch: "#37352f" },
];

/** Colour dots that switch the accent: blue (default), terracotta, mono. */
export function AccentSwitcher({ className }: { className?: string }) {
  // `null` until mounted so server and first client render match.
  const [pref, setPref] = useState<AccentPreference | null>(null);

  useEffect(() => {
    setPref(readAccentPreference());
  }, []);

  function choose(next: AccentPreference) {
    setPref(next);
    saveAccentPreference(next);
    applyAccent(next);
  }

  return (
    <div role="group" aria-label="포인트 컬러" className={cn("flex items-center", className)}>
      {OPTIONS.map((o) => {
        const pressed = pref === o.value;
        return (
          <Tooltip key={o.value} content={`포인트 컬러: ${o.label}`}>
            <button
              type="button"
              aria-label={`포인트 컬러: ${o.label}`}
              aria-pressed={pressed}
              onClick={() => choose(o.value)}
              className="grid size-6 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            >
              <span
                aria-hidden
                style={{ backgroundColor: o.swatch }}
                className={cn(
                  "size-3.5 rounded-full transition-shadow",
                  // Near-black ink dot would vanish on the dark sidebar without an edge.
                  o.value === "mono" && "dark:outline dark:outline-1 dark:outline-faint",
                  pressed && "ring-2 ring-fg ring-offset-2 ring-offset-surface",
                )}
              />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
