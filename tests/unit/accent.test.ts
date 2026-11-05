import { describe, expect, it } from "vitest";
import { accentInitSnippet, LEGACY_ACCENT_STORAGE_KEY } from "@/components/accent";

describe("accent (fixed mono)", () => {
  it("init snippet only removes the legacy key", () => {
    const store = new Map([[LEGACY_ACCENT_STORAGE_KEY, "terracotta"]]);
    const localStorage = { removeItem: (k: string) => void store.delete(k) };
    new Function("localStorage", accentInitSnippet)(localStorage);
    expect(store.has(LEGACY_ACCENT_STORAGE_KEY)).toBe(false);
    expect(accentInitSnippet).not.toContain("data-accent");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
function tokens(sel: string): Record<string, string> {
  const i = css.indexOf(`\n${sel} {`);
  const body = css.slice(i, css.indexOf("\n}", i));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)) out[m[1]] = m[2];
  return out;
}
const lum = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const cr = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("mono is the only accent and code colours are readable", () => {
  it("has no accent override blocks", () => {
    expect(css).not.toContain("data-accent");
  });
  for (const [name, sel] of [["light", ":root"], ["dark", ".dark"]] as const) {
    it(`${name}: code tokens >= 4.5:1 on --rb-code-bg`, () => {
      const t = tokens(sel);
      for (const k of ["fg", "comment", "keyword", "string", "number", "function", "attr", "variable", "inline"]) {
        expect(cr(t[`rb-code-${k === "fg" ? "fg" : k}`], t["rb-code-bg"]), k).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
