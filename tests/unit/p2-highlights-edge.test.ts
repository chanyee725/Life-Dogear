import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  highlights as highlightsTable,
  links as linksTable,
  thoughts as thoughtsTable,
} from "@/db/schema";
import { papers, thoughts } from "@/lib/repo";
import * as highlights from "@/lib/repo/highlights";
import {
  MAX_HIGHLIGHT_NOTE,
  MAX_HIGHLIGHT_TEXT,
  MAX_PAGE,
  MAX_RECTS,
  parseJumpParams,
  parseStoredRects,
  readerHref,
  scrollTargetFor,
  THOUGHT_TITLE_MAX,
  thoughtBodyFrom,
  thoughtTitleFrom,
  validateRects,
} from "@/lib/highlights";
import { useFreshDb } from "./repo-helpers";

let db: Awaited<ReturnType<typeof useFreshDb>>;
let paperId: string;

beforeEach(async () => {
  db = await useFreshDb();
  paperId = (await papers.create({ title: "경계 논문" })).id;
});

const MISSING = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
const RECT = { x: 0.1, y: 0.2, w: 0.5, h: 0.02 };
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const create = (over: Record<string, unknown> = {}) =>
  highlights.create({ paperId, page: 1, text: "텍스트", ...over } as highlights.HighlightInput);
const rejects = (over: Record<string, unknown>, code = "invalid") =>
  expect(create(over)).rejects.toMatchObject({ code });

describe("rects validation", () => {
  it.each([
    ["negative x", [{ ...RECT, x: -0.01 }]],
    ["negative y", [{ ...RECT, y: -1 }]],
    ["zero width", [{ ...RECT, w: 0 }]],
    ["negative height", [{ ...RECT, h: -0.1 }]],
    ["x above 1", [{ ...RECT, x: 1.5 }]],
    ["extends past the page", [{ x: 0.6, y: 0, w: 0.5, h: 0.1 }]],
    ["NaN", [{ ...RECT, x: Number.NaN }]],
    ["Infinity", [{ ...RECT, w: Number.POSITIVE_INFINITY }]],
    ["-Infinity", [{ ...RECT, y: Number.NEGATIVE_INFINITY }]],
    ["numeric strings", [{ x: "0.1", y: "0.2", w: "0.5", h: "0.02" }]],
    ["null entry", [null]],
    ["missing key", [{ x: 0.1, y: 0.2, w: 0.5 }]],
    ["not an array", { x: 0.1, y: 0.2, w: 0.5, h: 0.02 }],
    ["a string", "[]"],
  ])("rejects %s", async (_name, rects) => {
    await rejects({ rects });
  });

  it("accepts an empty array and omitted rects, stored as []", async () => {
    expect((await create({ rects: [] })).rects).toEqual([]);
    expect((await create()).rects).toEqual([]);
    expect((await highlights.listByPaper(paperId)).every((h) => h.rects.length === 0)).toBe(true);
  });

  it("accepts rects touching the page edge exactly", async () => {
    const edge = { x: 0.5, y: 0.5, w: 0.5, h: 0.5 };
    expect((await create({ rects: [edge] })).rects).toEqual([edge]);
    expect((await create({ rects: [{ x: 0, y: 0, w: 1, h: 1 }] })).rects).toHaveLength(1);
  });

  it("tolerates float noise at the edge but not a real overflow", () => {
    expect(validateRects([{ x: 0.9, y: 0, w: 0.1 + 1e-9, h: 0.1 }])).not.toBeNull();
    expect(validateRects([{ x: 0.9, y: 0, w: 0.1001, h: 0.1 }])).toBeNull();
  });

  it("drops extra keys and rounds to four decimals", async () => {
    const h = await create({ rects: [{ x: 0.123456, y: 0.2, w: 0.3, h: 0.05, evil: "<script>" }] });
    expect(h.rects).toEqual([{ x: 0.1235, y: 0.2, w: 0.3, h: 0.05 }]);
    expect(JSON.stringify(h.rects)).not.toContain("evil");
  });

  it("allows exactly MAX_RECTS rects and rejects one more", async () => {
    const many = (n: number) => Array.from({ length: n }, () => RECT);
    expect((await create({ rects: many(MAX_RECTS) })).rects).toHaveLength(MAX_RECTS);
    await rejects({ rects: many(MAX_RECTS + 1) });
    await rejects({ rects: many(100_000) });
  });

  it("reads broken stored JSON as no rects instead of failing the list", async () => {
    const h = await create({ rects: [RECT] });
    for (const broken of [
      "not json",
      "{",
      "null",
      '"x"',
      '{"x":1}',
      '[{"x":-1,"y":0,"w":1,"h":1}]',
      "",
    ]) {
      await db.update(highlightsTable).set({ rects: broken }).where(eq(highlightsTable.id, h.id));
      const [got] = await highlights.listByPaper(paperId);
      expect(got.rects).toEqual([]);
      expect((await highlights.get(h.id))!.rects).toEqual([]);
    }
  });

  it("parseStoredRects and scrollTargetFor survive garbage", () => {
    expect(parseStoredRects("[[]]")).toEqual([]);
    expect(scrollTargetFor([])).toBe(0);
    expect(scrollTargetFor([{ x: 0, y: 0.02, w: 0.1, h: 0.1 }])).toBe(0); // clamped, never negative
    expect(
      scrollTargetFor([
        { x: 0, y: 0.5, w: 0.1, h: 0.1 },
        { x: 0, y: 0.3, w: 0.1, h: 0.1 },
      ]),
    ).toBe(0.25);
  });
});

describe("color", () => {
  it.each(["", "purple", "YELLOW", " yellow", "#ffff00", "__proto__", "constructor", null, 1, {}])(
    "rejects %j",
    async (color) => {
      await rejects({ color });
    },
  );

  it.each(["yellow", "green", "blue", "rose"])("accepts %s", async (color) => {
    expect((await create({ color })).color).toBe(color);
  });

  it("defaults to yellow, rejects bad colours on update and falls back for stored junk", async () => {
    const h = await create();
    expect(h.color).toBe("yellow");
    await expect(highlights.update(h.id, { color: "purple" as never })).rejects.toMatchObject({
      code: "invalid",
    });
    await db
      .update(highlightsTable)
      .set({ color: "chartreuse" })
      .where(eq(highlightsTable.id, h.id));
    expect((await highlights.get(h.id))!.color).toBe("yellow");
  });
});

describe("page", () => {
  it.each([
    0,
    -1,
    1.5,
    0.99,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    MAX_PAGE + 1,
    "1",
    null,
    undefined,
  ])("rejects page %j", async (page) => {
    await rejects({ page });
  });

  // The total page count is unknown here (no PDF attached), so only MAX_PAGE bounds the page.
  it("accepts the first page and MAX_PAGE when the total page count is unknown", async () => {
    expect((await create({ page: 1 })).page).toBe(1);
    expect((await create({ page: MAX_PAGE })).page).toBe(MAX_PAGE);
  });

  it("rejects a page greater than the paper's total page count", async () => {
    await papers.setPdf(paperId, "data/pdfs/edge.pdf", 10);
    expect((await create({ page: 10 })).page).toBe(10);
    await rejects({ page: 11 });
  });
});

describe("text", () => {
  it("collapses whitespace, tabs, newlines and no-break spaces", async () => {
    expect((await create({ text: "  앞\n\n뒤\t끝  마지막  " })).text).toBe("앞 뒤 끝 마지막");
    expect((await create({ text: "line-\r\nbreak" })).text).toBe("line- break");
  });

  it.each(["", " ", "\n\t  ", "　　"])("rejects empty text %j", async (text) => {
    await rejects({ text });
  });

  it.each([undefined, null, 5, {}, ["a"]])("rejects non-string text %j", async (text) => {
    await rejects({ text });
  });

  it("allows exactly the maximum length and rejects one more", async () => {
    expect((await create({ text: "가".repeat(MAX_HIGHLIGHT_TEXT) })).text).toHaveLength(
      MAX_HIGHLIGHT_TEXT,
    );
    await rejects({ text: "가".repeat(MAX_HIGHLIGHT_TEXT + 1) });
  });

  it("keeps emoji, combining marks and markdown characters as typed", async () => {
    const text = "😀 한글 é **bold** `code` <b>x</b> | # ";
    expect((await create({ text })).text).toBe(text.trim());
  });
});

describe("note", () => {
  it("trims, treats null/undefined/blank as empty", async () => {
    expect((await create({ note: "  메모  " })).note).toBe("메모");
    expect((await create({ note: "   " })).note).toBe("");
    expect((await create({ note: null })).note).toBe("");
    expect((await create({ note: undefined })).note).toBe("");
  });

  it("allows exactly the maximum length and rejects one more", async () => {
    expect((await create({ note: "n".repeat(MAX_HIGHLIGHT_NOTE) })).note).toHaveLength(
      MAX_HIGHLIGHT_NOTE,
    );
    await rejects({ note: "n".repeat(MAX_HIGHLIGHT_NOTE + 1) });
    const h = await create();
    await expect(
      highlights.update(h.id, { note: "n".repeat(MAX_HIGHLIGHT_NOTE + 1) }),
    ).rejects.toMatchObject({
      code: "invalid",
    });
    await expect(highlights.update(h.id, { note: 5 as never })).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("keeps newlines inside a note and can clear it on update", async () => {
    const h = await create({ note: "첫 줄\n둘째 줄" });
    expect(h.note).toBe("첫 줄\n둘째 줄");
    expect((await highlights.update(h.id, { note: "" }))!.note).toBe("");
  });

  it("an empty patch changes nothing and an update does not touch text or rects", async () => {
    const h = await create({ rects: [RECT], note: "원본" });
    expect(await highlights.update(h.id, {})).toEqual(h);
    const after = await highlights.update(h.id, { color: "blue" });
    expect(after).toMatchObject({
      text: h.text,
      rects: [RECT],
      note: "원본",
      color: "blue",
      page: 1,
    });
  });
});

describe("ids and missing papers", () => {
  const badIds = [
    "",
    "nope",
    "../etc/passwd",
    "'; DROP TABLE papers; --",
    "A".repeat(81),
    MISSING.toUpperCase(),
    "seed-",
    " " + MISSING,
    null,
    5,
    {},
  ];

  it.each(badIds)("create rejects paperId %j as invalid", async (id) => {
    await rejects({ paperId: id });
  });

  it("reports not_found for a well-formed id that does not exist", async () => {
    await rejects({ paperId: MISSING }, "not_found");
    await rejects({ paperId: "seed-no-such-paper" }, "not_found");
    expect(await db.select().from(highlightsTable)).toEqual([]);
  });

  it.each(badIds)(
    "read/update/remove/createThought with %j return empty results, not errors",
    async (id) => {
      expect(await highlights.get(id as string)).toBeNull();
      expect(await highlights.update(id as string, { note: "x" })).toBeNull();
      expect(await highlights.remove(id as string)).toBe(false);
      expect(await highlights.createThought(id as string)).toBeNull();
      expect(await highlights.listByPaper(id as string)).toEqual([]);
    },
  );

  it("returns empty/null for well-formed ids that do not exist", async () => {
    expect(await highlights.listByPaper(MISSING)).toEqual([]);
    expect(await highlights.get(MISSING)).toBeNull();
    expect(await highlights.remove(MISSING)).toBe(false);
  });
});

describe("cascade on paper delete", () => {
  it("removes all highlights of the paper only", async () => {
    const other = (await papers.create({ title: "다른 논문" })).id;
    await create({ text: "지워질 것 1" });
    await create({ text: "지워질 것 2", page: 5 });
    const keep = await highlights.create({ paperId: other, page: 1, text: "남을 것" });

    expect((await papers.remove(paperId)).removed).toBe(true);

    expect(await highlights.listByPaper(paperId)).toEqual([]);
    expect(
      await db.select().from(highlightsTable).where(eq(highlightsTable.paperId, paperId)),
    ).toEqual([]);
    expect((await highlights.listByPaper(other)).map((h) => h.id)).toEqual([keep.id]);
  });
});

describe("thoughtTitleFrom", () => {
  it("keeps exactly 80 characters whole and cuts 81 with an ellipsis", () => {
    const t80 = "가".repeat(THOUGHT_TITLE_MAX);
    expect(thoughtTitleFrom(t80)).toBe(t80);
    expect(thoughtTitleFrom(t80 + "나")).toBe(`${t80}…`);
    expect(Array.from(thoughtTitleFrom("가".repeat(500))).length).toBe(THOUGHT_TITLE_MAX + 1);
  });

  it("counts emoji as one character and never splits a surrogate pair", () => {
    const e80 = "😀".repeat(THOUGHT_TITLE_MAX);
    expect(thoughtTitleFrom(e80)).toBe(e80);
    const cut = thoughtTitleFrom(e80 + "😀");
    expect(cut).toBe(`${e80}…`);
    expect(cut).not.toMatch(LONE_SURROGATE);
    expect(thoughtTitleFrom("a" + "😀".repeat(100))).not.toMatch(LONE_SURROGATE);
  });

  it("trims whitespace before the ellipsis and collapses line breaks", () => {
    expect(thoughtTitleFrom("가".repeat(79) + " " + "나".repeat(10))).toBe(`${"가".repeat(79)}…`);
    expect(thoughtTitleFrom("줄\n바꿈\r\n있음")).toBe("줄 바꿈 있음");
  });

  it("falls back to a default title for blank text", () => {
    expect(thoughtTitleFrom("   ")).toBe("하이라이트에서 만든 생각");
    expect(thoughtTitleFrom("")).toBe("하이라이트에서 만든 생각");
  });

  it("fits the thought title column limit", async () => {
    const { thoughtId } = (await highlights.createThought(
      (await create({ text: "가".repeat(5000) })).id,
    ))!;
    expect(Array.from((await thoughts.get(thoughtId))!.title).length).toBeLessThanOrEqual(
      THOUGHT_TITLE_MAX + 1,
    );
  });
});

describe("thoughtBodyFrom", () => {
  it("quotes on a single line with paper and page, note last", () => {
    expect(
      thoughtBodyFrom({ text: "a\nb", page: 3, note: " 내 생각 ", paperTitle: " 제목 " }),
    ).toBe("> a b\n\n— 제목, p. 3\n\n내 생각\n");
  });

  it("omits an empty or whitespace note", () => {
    for (const note of [undefined, "", "  \n "]) {
      expect(thoughtBodyFrom({ text: "a", page: 1, note, paperTitle: "T" })).toBe(
        "> a\n\n— T, p. 1\n",
      );
    }
  });

  it("keeps markdown-looking text on the quote line so it cannot start a heading", () => {
    const body = thoughtBodyFrom({ text: "# 제목처럼\n## 또", page: 1, paperTitle: "T" });
    expect(body.split("\n")[0]).toBe("> # 제목처럼 ## 또");
    expect(body.split("\n").filter((l) => /^#/.test(l))).toEqual([]);
  });
});

describe("createThought", () => {
  it("creates a linked memo/seed thought with the quoted body", async () => {
    const h = await create({ page: 12, text: "핵심\n주장", note: "나중에 확인" });
    const res = await highlights.createThought(h.id);
    expect(res).not.toBeNull();
    const t = (await thoughts.get(res!.thoughtId))!;
    expect(t).toMatchObject({
      title: "핵심 주장",
      kind: "memo",
      maturity: "seed",
      body: "> 핵심 주장\n\n— 경계 논문, p. 12\n\n나중에 확인\n",
    });
    const rows = await db.select().from(linksTable).where(eq(linksTable.sourceId, t.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sourceType: "thought",
      targetType: "paper",
      targetId: paperId,
    });
  });

  it("returns null for a missing highlight and creates nothing", async () => {
    expect(await highlights.createThought(MISSING)).toBeNull();
    expect(await db.select().from(thoughtsTable)).toEqual([]);
    expect(await db.select().from(linksTable)).toEqual([]);
  });

  it("makes two independent linked thoughts when called twice for one highlight", async () => {
    const h = await create({ text: "같은 하이라이트" });
    const a = await highlights.createThought(h.id);
    const b = await highlights.createThought(h.id);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.thoughtId).not.toBe(b!.thoughtId);
    expect(await db.select().from(thoughtsTable)).toHaveLength(2);
    expect(await db.select().from(linksTable)).toHaveLength(2);
    expect(await highlights.get(h.id)).not.toBeNull(); // the highlight itself is untouched
  });

  it("works for a long text with emoji at the title boundary", async () => {
    const h = await create({ text: "😀".repeat(81) });
    const t = (await thoughts.get((await highlights.createThought(h.id))!.thoughtId))!;
    expect(t.title).toBe(`${"😀".repeat(80)}…`);
    expect(t.title).not.toMatch(LONE_SURROGATE);
  });

  it("uses the paper title as it is now, and still works after the paper is renamed", async () => {
    const h = await create();
    await papers.update(paperId, { title: "바뀐 제목" });
    const t = (await thoughts.get((await highlights.createThought(h.id))!.thoughtId))!;
    expect(t.body).toContain("— 바뀐 제목, p. 1");
  });
});

describe("parseJumpParams (?page= & scroll=)", () => {
  const page = (p: unknown, s?: unknown) =>
    parseJumpParams({ page: p as string, ...(s === undefined ? {} : { scroll: s as string }) });

  it("reads plain positive integers", () => {
    expect(page("12")).toEqual({ page: 12, scroll: 0 });
    expect(page("1")).toEqual({ page: 1, scroll: 0 });
    expect(page("012")).toEqual({ page: 12, scroll: 0 });
    expect(page("999999")).toEqual({ page: 999999, scroll: 0 });
  });

  it.each([
    "",
    "0",
    "00",
    "-1",
    "+3",
    "1.5",
    "1e3",
    "abc",
    "12abc",
    " 3",
    "3 ",
    "０３",
    "٣",
    "1000000",
    "NaN",
    "Infinity",
    undefined,
  ])("returns null for page %j", (p) => {
    expect(page(p)).toBeNull();
  });

  it("uses the first value of a repeated parameter and ignores empty arrays", () => {
    expect(parseJumpParams({ page: ["3", "9"] })).toEqual({ page: 3, scroll: 0 });
    expect(parseJumpParams({ page: [] })).toBeNull();
    expect(parseJumpParams({ page: ["x", "3"] })).toBeNull();
    expect(parseJumpParams({ page: "2", scroll: ["0.5", "0.9"] })).toEqual({
      page: 2,
      scroll: 0.5,
    });
  });

  it("reads scroll fractions 0..1 and falls back to 0 otherwise", () => {
    expect(page("2", "0")).toEqual({ page: 2, scroll: 0 });
    expect(page("2", "0.25")).toEqual({ page: 2, scroll: 0.25 });
    expect(page("2", "0.999999")).toEqual({ page: 2, scroll: 0.999999 });
    expect(page("2", "1")).toEqual({ page: 2, scroll: 1 });
    expect(page("2", "1.0")).toEqual({ page: 2, scroll: 1 });
    for (const bad of [
      "1.5",
      "2",
      "-0.1",
      "-1",
      "abc",
      "",
      "1e-1",
      "NaN",
      "Infinity",
      "1.0001",
      "10",
      " 0.5",
    ]) {
      expect(page("2", bad)).toEqual({ page: 2, scroll: 0 });
    }
  });

  it("builds links that round-trip through the parser", () => {
    const href = readerHref(paperId, 7, 0.4);
    expect(href).toBe(`/papers/${paperId}/read?page=7&scroll=0.4`);
    const q = new URL(href, "http://x").searchParams;
    expect(parseJumpParams({ page: q.get("page")!, scroll: q.get("scroll")! })).toEqual({
      page: 7,
      scroll: 0.4,
    });
    expect(readerHref(paperId, 7)).toBe(`/papers/${paperId}/read?page=7`);
    expect(readerHref(paperId, 7, -1)).not.toContain("scroll");
    expect(readerHref(paperId, 7, Number.NaN)).not.toContain("scroll");
  });
});
