import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Token values of one top-level block (`:root {` or `.dark {`). */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  const body = css.slice(start, css.indexOf("\n}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)) out[m[1]] = m[2];
  return out;
}

function lum(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const SOURCES = ["task", "seminar", "review", "goal", "paper", "google"];
const THEMES = { light: block(":root"), dark: block(".dark") };

describe("calendar event palette", () => {
  for (const [name, t] of Object.entries(THEMES)) {
    it(`${name}: every source's text is >= 4.5:1 on its chip`, () => {
      for (const s of SOURCES) {
        const bg = t[`rb-ev-${s}-bg`];
        const fg = t[`rb-ev-${s}-fg`];
        expect(bg, s).toBeDefined();
        expect(contrast(fg, bg), `${s} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${name}: overdue (red) and done (muted) task text stay readable on the task chip`, () => {
      const bg = t["rb-ev-task-bg"];
      expect(contrast(t["rb-tone-red-fg"], bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t["rb-muted"], bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t["rb-muted"], t["rb-ev-seminar-bg"])).toBeGreaterThanOrEqual(4.5);
    });

    it(`${name}: weekend numbers are muted but readable on the page`, () => {
      for (const k of ["rb-sat", "rb-sun"]) {
        expect(contrast(t[k], t["rb-bg"]), k).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
