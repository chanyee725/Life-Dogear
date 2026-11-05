/**
 * Canvas drawing for graph nodes (`docs/design/graph.md` 2절). Shapes tell the kinds apart;
 * the color `C` comes from the color basis (1.2 kind / 1.3 area). `k` is the zoom
 * (globalScale): screen-px values are divided by it, graph-unit values are not.
 */
import { slotColor, type GraphColorBy } from "@/lib/graph/color";
import type { GraphNode, GraphNodeType } from "@/lib/graph/types";
import type { GraphTheme } from "./graph-theme";

/** Node color `C` (2.1): the kind's color, or its area slot's color (neutral without one). */
export function nodeColor(
  type: GraphNodeType,
  colorBy: GraphColorBy,
  areaSlot: number | null | undefined,
  theme: GraphTheme,
): string {
  return colorBy === "area" ? slotColor(areaSlot, theme.area, theme.neutral) : theme.kind[type];
}

/** Quarter-goal inner fill: `goalSoft` by kind, the canvas background by area (1.3). */
export function quarterGoalFill(colorBy: GraphColorBy, theme: GraphTheme): string {
  return colorBy === "area" ? theme.canvasBg : theme.goalSoft;
}

/** `#rgb`/`#rrggbb` → `rgba(…, a)`; other color strings are returned unchanged. */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (!hex.startsWith("#")) return color;
  const full =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex.length === 7
        ? hex
        : null;
  if (!full) return color;
  const n = parseInt(full.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: number,
  corner: number,
) {
  const h = side / 2;
  const c = Math.min(corner, h);
  ctx.moveTo(x - h + c, y - h);
  ctx.arcTo(x + h, y - h, x + h, y + h, c);
  ctx.arcTo(x + h, y + h, x - h, y + h, c);
  ctx.arcTo(x - h, y + h, x - h, y - h, c);
  ctx.arcTo(x - h, y - h, x + h, y - h, c);
  ctx.closePath();
}

/** Traces a node's outline for radius `r` (no fill/stroke). Shared by drawing and hit areas. */
export function traceShape(
  ctx: CanvasRenderingContext2D,
  type: GraphNodeType,
  x: number,
  y: number,
  r: number,
): void {
  ctx.beginPath();
  switch (type) {
    case "area":
      roundRect(ctx, x, y, 1.75 * r, 2);
      break;
    case "review":
      roundRect(ctx, x, y, 1.75 * r, 1);
      break;
    case "task":
      roundRect(ctx, x, y, 1.75 * r, 0.75);
      break;
    case "project":
    case "tag": {
      const s = 1.3 * r;
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s, y);
      ctx.closePath();
      break;
    }
    case "seminar": {
      // Upward triangle, centroid at (x, y), circumradius 1.3r.
      const R = 1.3 * r;
      const dx = R * Math.cos(Math.PI / 6);
      ctx.moveTo(x, y - R);
      ctx.lineTo(x + dx, y + R / 2);
      ctx.lineTo(x - dx, y + R / 2);
      ctx.closePath();
      break;
    }
    case "note": {
      // Downward triangle: the seminar ▲ turned 180° (graph.md 2.1).
      const R = 1.3 * r;
      const dx = R * Math.cos(Math.PI / 6);
      ctx.moveTo(x, y + R);
      ctx.lineTo(x + dx, y - R / 2);
      ctx.lineTo(x - dx, y - R / 2);
      ctx.closePath();
      break;
    }
    default:
      ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
}

/** Half-height of the drawn shape below the centre (for placing the label). */
export function shapeBottom(type: GraphNodeType, r: number): number {
  switch (type) {
    case "area":
    case "review":
    case "task":
      return 0.875 * r;
    case "project":
    case "tag":
    case "note":
      return 1.3 * r;
    case "seminar":
      return 0.65 * r;
    default:
      return r;
  }
}

/** Shape extents from the centre (above, below, to each side), for label placement. */
export function shapeExtents(
  type: GraphNodeType,
  r: number,
): { top: number; bottom: number; side: number } {
  const bottom = shapeBottom(type, r);
  const triangle = type === "seminar" || type === "note";
  const top = type === "seminar" ? 1.3 * r : type === "note" ? 0.65 * r : bottom;
  const side =
    type === "project" || type === "tag"
      ? 1.3 * r
      : triangle
        ? 1.3 * r * Math.cos(Math.PI / 6)
        : type === "area" || type === "review"
          ? 0.875 * r
          : r;
  return { top, bottom, side };
}

/**
 * Draws a node in its kind's shape at the current `ctx.globalAlpha`: filled with `color`,
 * or hollow (thought, topic, open task, quarter goal) with a `color` outline.
 */
export function drawNodeShape(
  ctx: CanvasRenderingContext2D,
  node: Pick<GraphNode, "type" | "horizon" | "done">,
  x: number,
  y: number,
  r: number,
  k: number,
  theme: GraphTheme,
  color: string,
  quarterFill: string = theme.goalSoft,
): void {
  const { type } = node;
  // Obsidian-style: every kind is a small dot; the kind shows as color (hollow = open item).
  traceShape(ctx, "paper", x, y, r);
  const outline = (fill: string, width: number) => {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = width / k;
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  switch (type) {
    case "goal":
      if (node.horizon === "quarter") {
        outline(quarterFill, 1.25);
        return;
      }
      ctx.fillStyle = color;
      ctx.fill();
      if (node.horizon === "life") {
        ctx.beginPath();
        ctx.arc(x, y, r + 2, 0, 2 * Math.PI);
        ctx.lineWidth = 1 / k;
        ctx.strokeStyle = color;
        ctx.stroke();
      }
      return;
    case "thought":
      outline(theme.canvasBg, 1.25);
      return;
    case "tag":
      outline(theme.canvasBg, 1);
      return;
    case "task":
      // Open: an empty check box. Done: filled, faded (today.md 7절).
      if (node.done) {
        const alpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha * 0.45;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = alpha;
      } else {
        outline(theme.canvasBg, 1.25);
      }
      return;
    default:
      ctx.fillStyle = color;
      ctx.fill();
  }
}

/** Focus/selection ring: `labelStrong` 2s (achromatic, 1.1), 3s outside the node edge. */
export function drawRing(
  ctx: CanvasRenderingContext2D,
  type: GraphNodeType,
  x: number,
  y: number,
  r: number,
  k: number,
  theme: GraphTheme,
): void {
  traceShape(ctx, "paper", x, y, r + 2.5 / k + (type === "goal" ? 2 : 0));
  ctx.lineWidth = 1.5 / k;
  ctx.strokeStyle = theme.labelStrong;
  ctx.stroke();
}

/** Label font size in screen px. */
const LABEL_PX = 12;

/**
 * Sets the label font at a fixed 12px. Drawing small `12/k` px text and letting the canvas
 * transform scale it makes Chrome round glyph advances at the tiny size ("Ro b o tics");
 * labels are therefore measured and drawn at 12px under `scale(1/k)`.
 */
function setLabelFont(ctx: CanvasRenderingContext2D, weight: number, theme: GraphTheme): void {
  ctx.font = `${weight} ${LABEL_PX}px ${theme.fontFamily}`;
  ctx.letterSpacing = "0px";
  ctx.fontKerning = "normal";
  ctx.textRendering = "geometricPrecision";
}

/** Label under the node: 12s text with a 3s background halo. Returns its box in graph units. */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  top: number,
  k: number,
  color: string,
  weight: number,
  theme: GraphTheme,
): { x0: number; y0: number; x1: number; y1: number } {
  ctx.save();
  ctx.translate(x, top);
  ctx.scale(1 / k, 1 / k);
  setLabelFont(ctx, weight, theme);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = theme.canvasBg;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  const w = ctx.measureText(text).width / k;
  ctx.restore();
  return { x0: x - w / 2, y0: top, x1: x + w / 2, y1: top + (LABEL_PX * 1.25) / k };
}

/** Measures a label box without drawing (for overlap checks). */
export function measureLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  top: number,
  k: number,
  weight: number,
  theme: GraphTheme,
): { x0: number; y0: number; x1: number; y1: number } {
  ctx.save();
  setLabelFont(ctx, weight, theme);
  const w = ctx.measureText(text).width / k;
  ctx.restore();
  return { x0: x - w / 2, y0: top, x1: x + w / 2, y1: top + (LABEL_PX * 1.25) / k };
}

let measureCanvas: CanvasRenderingContext2D | null = null;
/** Shared 2D context for measuring label text outside a frame. */
export function measureCtx(): CanvasRenderingContext2D {
  measureCanvas ??= document.createElement("canvas").getContext("2d")!;
  return measureCanvas;
}

/** Screen px a label adds below its shape: 3px gap + 12px × 1.25 line + 1.5px halo. */
export const LABEL_BELOW_PX = 3 + 15 + 1.5;
