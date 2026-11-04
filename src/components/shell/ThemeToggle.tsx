"use client";

import { useEffect, useState } from "react";
import { Segmented, type SegmentedOption } from "@/components/ui/Segmented";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";
import {
  applyTheme,
  readThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "./theme";

const OPTIONS: SegmentedOption<ThemePreference>[] = [
  { value: "system", label: "시스템 설정", icon: <MonitorIcon /> },
  { value: "light", label: "라이트", icon: <SunIcon /> },
  { value: "dark", label: "다크", icon: <MoonIcon /> },
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
    <Segmented
      ariaLabel="화면 테마"
      options={OPTIONS}
      value={pref}
      onChange={choose}
      className={className}
      fill
    />
  );
}
