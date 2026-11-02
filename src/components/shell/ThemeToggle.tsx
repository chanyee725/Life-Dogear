"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";
import {
  applyTheme,
  readThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "./theme";

const OPTIONS: { value: ThemePreference; label: string; icon: () => React.ReactElement }[] = [
  { value: "system", label: "시스템 설정", icon: MonitorIcon },
  { value: "light", label: "라이트", icon: SunIcon },
  { value: "dark", label: "다크", icon: MoonIcon },
];

/** Three-way segmented control: system / light / dark. */
export function ThemeToggle({ className }: { className?: string }) {
  // `null` until mounted so server and first client render match.
  const [pref, setPref] = useState<ThemePreference | null>(null);

  useEffect(() => {
    setPref(readThemePreference());
  }, []);

  useEffect(() => {
    if (pref !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [pref]);

  function choose(next: ThemePreference) {
    setPref(next);
    saveThemePreference(next);
    applyTheme(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="화면 테마"
      className={cn("flex gap-0.5 rounded-lg bg-subtle p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            aria-label={label}
            onClick={() => choose(value)}
            className={cn(
              "flex h-6 flex-1 items-center justify-center rounded-md transition-colors",
              active ? "bg-bg text-fg shadow-sm" : "text-faint hover:text-muted",
            )}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
