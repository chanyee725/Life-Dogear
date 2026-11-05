"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
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
];

/** Two colour dots that switch the accent between blue (default) and terracotta. */
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
    <div role="group" aria-label="포인트 컬러" className={cn("flex items-center gap-1", className)}>
      <span className="mr-auto text-xs text-muted">포인트 컬러</span>
      {OPTIONS.map((o) => {
        const pressed = pref === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-label={`포인트 컬러: ${o.label}`}
            aria-pressed={pressed}
            title={o.label}
            onClick={() => choose(o.value)}
            className="grid size-6 place-items-center rounded-full"
          >
            <span
              aria-hidden
              style={{ backgroundColor: o.swatch }}
              className={cn(
                "size-3.5 rounded-full transition-shadow",
                pressed && "ring-2 ring-fg ring-offset-2 ring-offset-surface",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
