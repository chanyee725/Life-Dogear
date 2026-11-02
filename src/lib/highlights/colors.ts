/**
 * Highlight colours. Fills are translucent and drawn with `mix-blend-mode: multiply`
 * over the (always white) PDF page, so they read the same in light and dark mode.
 */
export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "rose"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = "yellow";

export const HIGHLIGHT_COLOR_LABEL: Record<HighlightColor, string> = {
  yellow: "노랑",
  green: "초록",
  blue: "파랑",
  rose: "분홍",
};

/** Overlay fill on the page. */
export const HIGHLIGHT_FILL: Record<HighlightColor, string> = {
  yellow: "rgba(250, 204, 21, 0.38)",
  green: "rgba(74, 222, 128, 0.32)",
  blue: "rgba(96, 165, 250, 0.32)",
  rose: "rgba(251, 113, 133, 0.30)",
};

/** Solid swatch for buttons and list markers. */
export const HIGHLIGHT_SWATCH: Record<HighlightColor, string> = {
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  rose: "#f43f5e",
};

export const isHighlightColor = (v: unknown): v is HighlightColor =>
  typeof v === "string" && (HIGHLIGHT_COLORS as readonly string[]).includes(v);

/** Stored values outside the palette (older data) fall back to the default. */
export const toHighlightColor = (v: unknown): HighlightColor =>
  isHighlightColor(v) ? v : DEFAULT_HIGHLIGHT_COLOR;
