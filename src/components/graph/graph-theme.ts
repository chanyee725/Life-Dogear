"use client";

/**
 * Canvas colors for the graph (`docs/design/graph.md` 1절). The canvas cannot read CSS
 * variables per frame, so light/dark values live here as constants; the hooks re-read
 * when the `dark` class on `<html>` changes. Neutral nodes, accent for goals only.
 */
import { useEffect, useState } from "react";

export type GraphTheme = {
  dark: boolean;
  canvasBg: string;
  gray1: string;
  gray2: string;
  gray3: string;
  gray4: string;
  gray5: string;
  accent: string;
  accentSoft: string;
  edge: string;
  label: string;
  labelStrong: string;
  divider: string;
  /** Alpha of nodes outside the hover/selection neighbourhood. */
  dimAlpha: number;
  /** Alpha of `belongs` edges at rest. */
  belongsAlpha: number;
  fontFamily: string;
};

const FONT_FALLBACK = "ui-sans-serif, system-ui, sans-serif";

export const GRAPH_THEME_LIGHT: GraphTheme = {
  dark: false,
  canvasBg: "#ffffff",
  gray1: "#3f3f46",
  gray2: "#52525b",
  gray3: "#6b6b73",
  gray4: "#82828b",
  gray5: "#8a8a93",
  accent: "#4f5bd5",
  accentSoft: "#eef0fc",
  edge: "#18181b",
  label: "#6b6b73",
  labelStrong: "#18181b",
  divider: "#e7e7ea",
  dimAlpha: 0.12,
  belongsAlpha: 0.5,
  fontFamily: FONT_FALLBACK,
};

export const GRAPH_THEME_DARK: GraphTheme = {
  dark: true,
  canvasBg: "#141416",
  gray1: "#d4d4d8",
  gray2: "#b4b4bc",
  gray3: "#9d9da6",
  gray4: "#85858e",
  gray5: "#7c7c85",
  accent: "#8b94f0",
  accentSoft: "#23253a",
  edge: "#ececef",
  label: "#9d9da6",
  labelStrong: "#ececef",
  divider: "#2a2a2f",
  dimAlpha: 0.18,
  belongsAlpha: 0.45,
  fontFamily: FONT_FALLBACK,
};

function readTheme(): GraphTheme {
  const dark = document.documentElement.classList.contains("dark");
  const base = dark ? GRAPH_THEME_DARK : GRAPH_THEME_LIGHT;
  const font = getComputedStyle(document.body).fontFamily;
  return font ? { ...base, fontFamily: font } : base;
}

/** Theme for the current `<html class>`; updates when dark mode toggles. */
export function useGraphTheme(): GraphTheme {
  const [theme, setTheme] = useState<GraphTheme>(GRAPH_THEME_LIGHT);
  useEffect(() => {
    setTheme(readTheme());
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/** `prefers-reduced-motion: reduce`. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}
