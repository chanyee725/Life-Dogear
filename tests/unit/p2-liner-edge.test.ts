import { describe, expect, it } from "vitest";
import {
  appendLinerMemo,
  appendLinerMemoEntry,
  formatLinerMemo,
  LINER_SECTION_HEADING,
  MAX_LINER_MEMO_TEXT,
  validateLinerMemoInput,
} from "@/lib/liner";

const NOW = new Date(2026, 10, 2, 12, 0, 0);
const memo = (text: string) => formatLinerMemo({ kind: "answer", text, date: "2026-11-02" });
/** Counts lines that are exactly `needle` (a real heading, not a quoted or longer line). */
const count = (haystack: string, needle: string) =>
  haystack.split("\n").filter((l) => l.trim() === needle).length;
const HEADING = LINER_SECTION_HEADING;

describe("appendLinerMemo: section position", () => {
  it("creates the section for an empty body", () => {
    expect(appendLinerMemo("", "BLOCK")).toBe(`${HEADING}\n\nBLOCK\n`);
  });

  it("creates the section at the end when missing, keeping the body intact", () => {
    const body = "# 제목\n\n본문 한 줄\n\n## 다른 섹션\n\n내용\n";
    const out = appendLinerMemo(body, "BLOCK");
    expect(out.startsWith(body.trimEnd())).toBe(true);
    expect(count(out, HEADING)).toBe(1);
    expect(out.endsWith(`${HEADING}\n\nBLOCK\n`)).toBe(true);
  });

  it("appends inside a section located at the very end", () => {
    const body = `# T\n\n${HEADING}\n\nOLD\n`;
    const out = appendLinerMemo(body, "NEW");
    expect(out).toBe(`# T\n\n${HEADING}\n\nOLD\n\nNEW\n`);
  });

  it("appends inside a section located in the middle, before the next heading", () => {
    const body = `# T\n\n${HEADING}\n\nOLD\n\n## 다음\n\n뒤 내용\n`;
    const out = appendLinerMemo(body, "NEW");
    expect(out).toBe(`# T\n\n${HEADING}\n\nOLD\n\nNEW\n\n## 다음\n\n뒤 내용\n`);
  });

  it("closes the section at a level-1 heading as well", () => {
    const out = appendLinerMemo(`${HEADING}\n\nOLD\n\n# 최상위\n\n뒤\n`, "NEW");
    expect(out.indexOf("NEW")).toBeLessThan(out.indexOf("# 최상위"));
  });

  it("does not close the section at a level-3 heading (memo blocks use ###)", () => {
    const out = appendLinerMemo(`${HEADING}\n\n### 요약 · 2026-11-01\n\n> a\n\n## 다음\n`, "NEW");
    expect(out.indexOf("NEW")).toBeGreaterThan(out.indexOf("### 요약"));
    expect(out.indexOf("NEW")).toBeLessThan(out.indexOf("## 다음"));
  });

  it("uses the first section when two have the same title", () => {
    const body = `${HEADING}\n\nFIRST\n\n## 중간\n\nmid\n\n${HEADING}\n\nSECOND\n`;
    const out = appendLinerMemo(body, "NEW");
    expect(out.indexOf("NEW")).toBeGreaterThan(out.indexOf("FIRST"));
    expect(out.indexOf("NEW")).toBeLessThan(out.indexOf("## 중간"));
    expect(out).toContain("SECOND");
    expect(count(out, HEADING)).toBe(2);
  });

  it("ignores a memo heading inside a code fence", () => {
    const body = "```\n" + HEADING + "\nfake\n```\n";
    const out = appendLinerMemo(body, "NEW");
    expect(body.trimEnd() && out.startsWith(body.trimEnd())).toBe(true);
    expect(out.endsWith(`${HEADING}\n\nNEW\n`)).toBe(true);
  });

  it("accepts a heading with trailing spaces or closing hashes", () => {
    expect(appendLinerMemo(`## 라이너 스콜라 메모  \n\nOLD\n`, "NEW")).toContain("OLD\n\nNEW");
    expect(appendLinerMemo(`## 라이너 스콜라 메모 ##\n\nOLD\n`, "NEW")).toContain("OLD\n\nNEW");
  });

  it("does not treat a similarly named heading as the section", () => {
    const out = appendLinerMemo("## 라이너 스콜라 메모 정리\n\nx\n", "NEW");
    expect(count(out, HEADING)).toBe(1);
    expect(out).toContain("## 라이너 스콜라 메모 정리");
  });

  it("is stable when applied twice (one section, both blocks, in order)", () => {
    const out = appendLinerMemo(appendLinerMemo("본문", "ONE"), "TWO");
    expect(count(out, HEADING)).toBe(1);
    expect(out.indexOf("ONE")).toBeLessThan(out.indexOf("TWO"));
  });

  it("normalises CRLF bodies to LF without losing content", () => {
    const body = `# T\r\n\r\n${HEADING}\r\n\r\nOLD\r\n\r\n## 다음\r\n\r\n뒤\r\n`;
    const out = appendLinerMemo(body, "NEW");
    expect(out).not.toContain("\r");
    expect(out).toBe(`# T\n\n${HEADING}\n\nOLD\n\nNEW\n\n## 다음\n\n뒤\n`);
  });

  it("handles a body that is only whitespace", () => {
    expect(appendLinerMemo("\n\n  \n", "NEW")).toBe(`${HEADING}\n\nNEW\n`);
  });
});

describe("formatLinerMemo: hostile pasted text", () => {
  it("quotes headings so they cannot start or end a section", () => {
    const block = memo("## 가짜 섹션\n# 최상위");
    expect(block.split("\n").filter((l) => /^#{1,2}\s/.test(l))).toEqual([]);
  });

  it("keeps ``` fences from swallowing the rest of the body", () => {
    const block = memo("앞\n```js\ncode\n```\n뒤");
    const body = appendLinerMemo(`# T\n\n${HEADING}\n\nOLD\n\n## 다음\n\n뒤 내용\n`, block);
    expect(body.indexOf("## 다음")).toBeGreaterThan(body.indexOf("```js"));
    // A second memo still lands inside the section, before "## 다음".
    const again = appendLinerMemo(body, memo("두번째"));
    expect(again.indexOf("두번째")).toBeLessThan(again.indexOf("## 다음"));
    expect(count(again, HEADING)).toBe(1);
  });

  it("keeps an unclosed ``` fence from hiding the section from later appends", () => {
    const body = appendLinerMemo("본문", memo("열린 펜스\n```js\nnever closed"));
    const again = appendLinerMemo(body, memo("두번째"));
    expect(count(again, HEADING)).toBe(1);
    expect(again).toContain("두번째");
  });

  it("keeps ~~~ and indented fences from changing section boundaries", () => {
    const body = appendLinerMemo("본문", memo("~~~\n## x\n~~~\n   ```\n## y"));
    const again = appendLinerMemo(body, memo("두번째"));
    expect(count(again, HEADING)).toBe(1);
  });

  it("does not let pasted text fake a memo heading", () => {
    const body = appendLinerMemo("본문", memo(HEADING));
    expect(count(body, HEADING)).toBe(1);
  });

  it("normalises CRLF and lone CR in pasted text", () => {
    const block = memo("a\r\nb\rc");
    expect(block).not.toContain("\r");
    expect(block).toContain("> a\n> b\n> c");
  });

  it("keeps blank lines inside the quote and trims the ends", () => {
    expect(memo("\n\n  첫\n\n끝  \n\n")).toBe(
      "### 답변 · 2026-11-02\n\n>   첫\n>\n> 끝\n\n출처: 라이너 스콜라",
    );
  });

  it("keeps a very long single line and many lines intact", () => {
    const long = "가".repeat(MAX_LINER_MEMO_TEXT);
    expect(memo(long)).toContain(`> ${long}`);
    const many = Array.from({ length: 5000 }, (_, i) => `줄 ${i}`).join("\n");
    const block = memo(many);
    expect(block.split("\n").filter((l) => l.startsWith("> ")).length).toBe(5000);
  });
});

describe("validateLinerMemoInput boundaries", () => {
  const ok = { kind: "answer", text: "x" };

  it("rejects empty and whitespace-only text", () => {
    for (const text of ["", " ", "\n\t \r\n", undefined, null, 5]) {
      expect(validateLinerMemoInput({ kind: "answer", text })).toBe("empty");
    }
  });

  it("accepts exactly the maximum length and rejects one more", () => {
    expect(validateLinerMemoInput({ ...ok, text: "a".repeat(MAX_LINER_MEMO_TEXT) })).toBeNull();
    expect(validateLinerMemoInput({ ...ok, text: "a".repeat(MAX_LINER_MEMO_TEXT + 1) })).toBe(
      "too_long",
    );
  });

  it("rejects unknown kinds", () => {
    for (const kind of ["", "note", undefined, null, 1]) {
      expect(validateLinerMemoInput({ kind, text: "x" })).toBe("kind");
    }
  });

  it("validates the source link", () => {
    for (const sourceUrl of [undefined, null, ""])
      expect(validateLinerMemoInput({ ...ok, sourceUrl })).toBeNull();
    expect(validateLinerMemoInput({ ...ok, sourceUrl: "https://liner.com/review/1" })).toBeNull();
    for (const sourceUrl of [
      "javascript:alert(1)",
      "ftp://x.test/a",
      "liner.com/a",
      "https://u:p@liner.com/a",
      5,
    ]) {
      expect(validateLinerMemoInput({ ...ok, sourceUrl })).toBe("source_url");
    }
  });
});

describe("appendLinerMemoEntry", () => {
  it("stamps the local date and appends to an empty body", () => {
    const out = appendLinerMemoEntry("", { kind: "highlight", text: "한 줄" }, NOW);
    expect(out).toBe(
      `${HEADING}\n\n### 하이라이트 · 2026-11-02\n\n> 한 줄\n\n출처: 라이너 스콜라\n`,
    );
  });
});
