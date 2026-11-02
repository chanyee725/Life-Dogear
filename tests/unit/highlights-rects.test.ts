import { describe, expect, it } from "vitest";
import {
  isPageSized,
  mergeLineRects,
  parseStoredRects,
  scrollTargetFor,
  thoughtBodyFrom,
  thoughtTitleFrom,
  toHighlightColor,
  toPageRatios,
  validateRects,
  MAX_RECTS,
} from "@/lib/highlights";

const PAGE = { left: 100, top: 50, width: 400, height: 800 };

describe("toPageRatios", () => {
  it("converts client rects to page fractions independent of zoom", () => {
    const at1x = toPageRatios([{ left: 140, top: 130, width: 200, height: 16 }], PAGE);
    expect(at1x).toEqual([{ x: 0.1, y: 0.1, w: 0.5, h: 0.02 }]);
    // Same text at 2x zoom: page and rect both double.
    const page2x = { left: 100, top: 50, width: 800, height: 1600 };
    const at2x = toPageRatios([{ left: 180, top: 210, width: 400, height: 32 }], page2x);
    expect(at2x).toEqual(at1x);
  });

  it("merges runs on one line and keeps separate lines", () => {
    const rects = toPageRatios(
      [
        { left: 140, top: 130, width: 100, height: 16 },
        { left: 242, top: 131, width: 98, height: 15 },
        { left: 140, top: 150, width: 120, height: 16 },
      ],
      PAGE,
    );
    expect(rects).toHaveLength(2);
    expect(rects[0]).toEqual({ x: 0.1, y: 0.1, w: 0.5, h: 0.02 });
    expect(rects[1].y).toBeCloseTo(0.125);
  });

  it("clips to the page and drops empty or off-page rects", () => {
    const rects = toPageRatios(
      [
        { left: 50, top: 60, width: 100, height: 8 }, // starts left of the page
        { left: 600, top: 60, width: 50, height: 8 }, // right of the page
        { left: 200, top: 60, width: 0, height: 8 }, // empty
      ],
      PAGE,
    );
    expect(rects).toEqual([{ x: 0, y: 0.0125, w: 0.125, h: 0.01 }]);
    expect(toPageRatios([{ left: 1, top: 1, width: 1, height: 1 }], { ...PAGE, width: 0 })).toEqual(
      [],
    );
  });
});

describe("page-sized rects", () => {
  it("drops fillers that cover the page or exceed a line height, keeps text", () => {
    const rects = toPageRatios(
      [
        { left: 100, top: 50, width: 400, height: 800 }, // whole page (endOfContent)
        { left: 100, top: 450, width: 400, height: 410 }, // half-page tall filler
        { left: 140, top: 130, width: 200, height: 16 }, // a text line
      ],
      PAGE,
    );
    expect(rects).toEqual([{ x: 0.1, y: 0.1, w: 0.5, h: 0.02 }]);
    expect(isPageSized({ x: 0, y: 0, w: 1, h: 0.95 })).toBe(true);
    expect(isPageSized({ x: 0, y: 0.1, w: 1, h: 0.03 })).toBe(false);
  });
});

describe("mergeLineRects", () => {
  it("does not merge distant runs on the same line", () => {
    expect(
      mergeLineRects([
        { x: 0.1, y: 0.1, w: 0.1, h: 0.02 },
        { x: 0.6, y: 0.1, w: 0.1, h: 0.02 },
      ]),
    ).toHaveLength(2);
  });
});

describe("validateRects / parseStoredRects", () => {
  it("accepts fractions inside the page and strips extra keys", () => {
    expect(validateRects([{ x: 0.1, y: 0.2, w: 0.3, h: 0.04, extra: 1 }])).toEqual([
      { x: 0.1, y: 0.2, w: 0.3, h: 0.04 },
    ]);
    expect(validateRects([])).toEqual([]);
  });

  it.each([
    null,
    "[]",
    [{ x: -0.1, y: 0, w: 0.1, h: 0.1 }],
    [{ x: 0.9, y: 0, w: 0.2, h: 0.1 }],
    [{ x: 0, y: 0, w: 0, h: 0.1 }],
    [{ x: 0, y: 0, w: Number.NaN, h: 0.1 }],
    [{ x: "0", y: 0, w: 0.1, h: 0.1 }],
    [null],
    Array.from({ length: MAX_RECTS + 1 }, () => ({ x: 0, y: 0, w: 0.1, h: 0.1 })),
  ])("rejects %#", (value) => {
    expect(validateRects(value)).toBeNull();
  });

  it("reads stored JSON defensively", () => {
    expect(parseStoredRects('[{"x":0.1,"y":0.1,"w":0.1,"h":0.1}]')).toHaveLength(1);
    expect(parseStoredRects("not json")).toEqual([]);
    expect(parseStoredRects('[{"x":2}]')).toEqual([]);
  });

  it("scrolls a little above the first rect", () => {
    expect(scrollTargetFor([])).toBe(0);
    expect(
      scrollTargetFor([
        { x: 0, y: 0.5, w: 0.1, h: 0.1 },
        { x: 0, y: 0.3, w: 0.1, h: 0.1 },
      ]),
    ).toBe(0.25);
    expect(scrollTargetFor([{ x: 0, y: 0.01, w: 0.1, h: 0.1 }])).toBe(0);
  });
});

describe("thought text", () => {
  it("cuts long titles and keeps short ones", () => {
    expect(thoughtTitleFrom("  짧은\n 문장 ")).toBe("짧은 문장");
    const long = "가".repeat(100);
    expect(thoughtTitleFrom(long)).toBe(`${"가".repeat(80)}…`);
    expect(thoughtTitleFrom("😀".repeat(81))).toBe(`${"😀".repeat(80)}…`);
    expect(thoughtTitleFrom("   ")).toBe("하이라이트에서 만든 생각");
  });

  it("quotes text with paper title, page and note", () => {
    expect(
      thoughtBodyFrom({ text: "a\nb", page: 3, note: " 메모 ", paperTitle: "가짜 논문 " }),
    ).toBe("> a b\n\n— 가짜 논문, p. 3\n\n메모\n");
    expect(thoughtBodyFrom({ text: "a", page: 1, note: "", paperTitle: "T" })).toBe(
      "> a\n\n— T, p. 1\n",
    );
  });

  it("falls back to the default colour for unknown values", () => {
    expect(toHighlightColor("green")).toBe("green");
    expect(toHighlightColor("purple")).toBe("yellow");
  });
});
