"use client";

/**
 * Canvas colors for the graph (`docs/design/graph.md` 1절). The canvas cannot read CSS
 * variables per frame, so light/dark values live here as constants; the hooks re-read
 * when the `dark` class on `<html>` changes. Nodes are colored by kind (1.2) or by area
 * (1.3); shapes still tell the kinds apart.
 */
import { useEffect, useState } from "react";
import type { GraphNodeType } from "@/lib/graph/types";

export type GraphTheme = {
  dark: boolean;
  canvasBg: string;
  /** Node color per kind (1.2). */
  kind: Readonly<Record<GraphNodeType, string>>;
  /** Quarter-goal inner fill when colored by kind (1.2 `goalSoft`). */
  goalSoft: string;
  /** Area palette (1.3): the i-th used area takes `area[i % 12]`. */
  area: readonly string[];
  /** Color by area: nodes without an area (1.3 `neutral`). */
  neutral: string;
  /** Legacy grays/accent: only the cosmos side panel's icon theme still sets these. */
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
  /** Alpha of `belongs` edges at rest (1.5). */
  belongsAlpha: number;
  /** Alpha of `link`/`body`/`topic` edges at rest (1.5; light is higher — colored lines fade more on white). */
  linkAlpha: number;
  fontFamily: string;
};

const FONT_FALLBACK = "ui-sans-serif, system-ui, sans-serif";

export const GRAPH_THEME_LIGHT: GraphTheme = {
  dark: false,
  canvasBg: "#fafafa",
  kind: {
    goal: "#cc3430",
    area: "#953466",
    project: "#6142aa",
    paper: "#348dcf",
    seminar: "#038586",
    thought: "#c8800d",
    note: "#773a10",
    task: "#357339",
    review: "#756960",
    tag: "#828fa0",
  },
  goalSoft: "#fbecea",
  area: [
    "#1587ba",
    "#cc6c13",
    "#167b26",
    "#db5b94",
    "#875cc6",
    "#169d97",
    "#7a8e24",
    "#dd5652",
    "#1f53b8",
    "#2f9074",
    "#95489b",
    "#7f4d30",
  ],
  neutral: "#71747c",
  gray1: "#3f3f46",
  gray2: "#52525b",
  gray3: "#6b6b73",
  gray4: "#82828b",
  gray5: "#8a8a93",
  accent: "#4f5bd5",
  accentSoft: "#eef0fc",
  edge: "#8b9099",
  label: "#52525b",
  labelStrong: "#18181b",
  divider: "#e7e7ea",
  dimAlpha: 0.12,
  belongsAlpha: 0.55,
  linkAlpha: 0.42,
  fontFamily: FONT_FALLBACK,
};

export const GRAPH_THEME_DARK: GraphTheme = {
  dark: true,
  canvasBg: "#141416",
  kind: {
    goal: "#f27166",
    area: "#d474a1",
    project: "#977ee5",
    paper: "#75bffc",
    seminar: "#78d7d6",
    thought: "#f6c16b",
    note: "#b9632c",
    task: "#7ec180",
    review: "#8f847c",
    tag: "#a5b2c4",
  },
  goalSoft: "#311e1c",
  area: [
    "#5abdf2",
    "#ed914c",
    "#5bb661",
    "#d76797",
    "#a07cdb",
    "#50ddd5",
    "#b8d259",
    "#f28881",
    "#6a9cfb",
    "#5cb99b",
    "#d896db",
    "#b67d5d",
  ],
  neutral: "#b4b7bf",
  gray1: "#d4d4d8",
  gray2: "#b4b4bc",
  gray3: "#9d9da6",
  gray4: "#85858e",
  gray5: "#7c7c85",
  accent: "#8b94f0",
  accentSoft: "#23253a",
  edge: "#8d929c",
  label: "#b4b4bd",
  labelStrong: "#ececef",
  divider: "#2a2a2f",
  dimAlpha: 0.18,
  belongsAlpha: 0.45,
  linkAlpha: 0.34,
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

/**
 * Cosmos view colors (docs/design/cosmos.md 1절). One constant: the cosmos canvas is
 * always dark, whatever the app theme.
 */
export const COSMOS_THEME = {
  space: "#0b0e1a",
  spaceRaised: "#121729",
  spaceBorder: "#262d47",
  starWhite: "#ffffff",
  starBlue: "#cfd8ff",
  starWarm: "#ffe9c4",
  neutral: "#a6abb5",
  gold: "#f8ca65",
  goldCore: "#fff5d7",
  path: "#ffe3a3",
  edge: "#cfd5ea",
  label: "#c7cbd9",
  labelStrong: "#f3f4f8",
  focus: "#8b94f0",
} as const;

/** Area (galaxy) palette, in area order; the i-th area uses GALAXY[i % 12] (1.1). */
export const GALAXY = [
  "#5dcbff",
  "#ff9b50",
  "#6fda75",
  "#f77cb0",
  "#b58bf9",
  "#49e9e0",
  "#cae763",
  "#f2716a",
  "#6095fa",
  "#97f4d4",
  "#efa6f2",
  "#bf825f",
] as const;
