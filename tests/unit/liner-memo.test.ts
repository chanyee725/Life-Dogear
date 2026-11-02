import { describe, expect, it } from "vitest";
import {
  appendLinerMemo,
  appendLinerMemoEntry,
  buildLinerSearchUrl,
  formatLinerMemo,
  formatLocalDate,
  LINER_SCHOLAR_URL,
  LINER_SECTION_HEADING,
  MAX_LINER_MEMO_TEXT,
  safeSourceUrl,
  validateLinerMemoInput,
} from "@/lib/liner";
import { PAPER_TEMPLATE } from "@/lib/templates";

const BLOCK = "### 요약 · 2026-11-02\n\n> 새 메모\n\n출처: 라이너 스콜라";

describe("formatLinerMemo", () => {
  it("quotes the text and adds kind, date and source", () => {
    expect(
      formatLinerMemo({
        kind: "highlight",
        text: "\r\n첫 줄\r\n\r\n## 머리말처럼 보이는 줄\n  ",
        sourceUrl: "https://liner.com/review/abc(1) x",
        date: "2026-11-02",
      }),
    ).toBe(
      [
        "### 하이라이트 · 2026-11-02",
        "",
        "> 첫 줄",
        ">",
        "> ## 머리말처럼 보이는 줄",
        "",
        "출처: [라이너](https://liner.com/review/abc%281%29%20x)",
      ].join("\n"),
    );
  });

  it("falls back to a plain source line without a usable URL", () => {
    for (const sourceUrl of [undefined, "", "javascript:alert(1)", "not a url"]) {
      expect(formatLinerMemo({ kind: "answer", text: "답", sourceUrl, date: "2026-01-02" })).toBe(
        "### 답변 · 2026-01-02\n\n> 답\n\n출처: 라이너 스콜라",
      );
    }
  });
});

describe("safeSourceUrl", () => {
  it("accepts http(s) only and rejects credentials", () => {
    expect(safeSourceUrl(" https://liner.com/a ")).toBe("https://liner.com/a");
    expect(safeSourceUrl("http://liner.com/a")).toBe("http://liner.com/a");
    expect(safeSourceUrl("ftp://liner.com/a")).toBeNull();
    expect(safeSourceUrl("https://user:pw@liner.com/")).toBeNull();
    expect(safeSourceUrl("https://liner.com/" + "a".repeat(2_100))).toBeNull();
  });
});

describe("appendLinerMemo", () => {
  it("appends at the end of the existing section, before the next heading", () => {
    const body = "## 내 생각\n\n좋다\n\n## 라이너 스콜라 메모\n\n이전 메모\n\n\n## 부록\n\n끝\n";
    expect(appendLinerMemo(body, BLOCK)).toBe(
      `## 내 생각\n\n좋다\n\n## 라이너 스콜라 메모\n\n이전 메모\n\n${BLOCK}\n\n## 부록\n\n끝\n`,
    );
  });

  it("fills the empty section of the paper template", () => {
    const next = appendLinerMemo(PAPER_TEMPLATE, BLOCK);
    expect(next.startsWith(PAPER_TEMPLATE.trimEnd())).toBe(true);
    expect(next.endsWith(`${LINER_SECTION_HEADING}\n\n${BLOCK}\n`)).toBe(true);
  });

  it("keeps earlier memos and ### headings inside the section", () => {
    const once = appendLinerMemo("## 라이너 스콜라 메모\n", BLOCK);
    const twice = appendLinerMemo(once, BLOCK.replace("새 메모", "두 번째"));
    expect(twice).toBe(
      `## 라이너 스콜라 메모\n\n${BLOCK}\n\n${BLOCK.replace("새 메모", "두 번째")}\n`,
    );
  });

  it("creates the section at the end when missing", () => {
    expect(appendLinerMemo("## 왜 읽나\n\n궁금해서\n\n", BLOCK)).toBe(
      `## 왜 읽나\n\n궁금해서\n\n${LINER_SECTION_HEADING}\n\n${BLOCK}\n`,
    );
    expect(appendLinerMemo("", BLOCK)).toBe(`${LINER_SECTION_HEADING}\n\n${BLOCK}\n`);
  });

  it("ignores a look-alike heading inside a code fence", () => {
    const body = "```\n## 라이너 스콜라 메모\n```\n";
    expect(appendLinerMemo(body, BLOCK)).toBe(
      `\`\`\`\n## 라이너 스콜라 메모\n\`\`\`\n\n${LINER_SECTION_HEADING}\n\n${BLOCK}\n`,
    );
  });

  it("does not end the section at a heading inside a code fence", () => {
    const body = "## 라이너 스콜라 메모\n\n```md\n## not a heading\n```\n\n## 다음\n";
    expect(appendLinerMemo(body, BLOCK)).toBe(
      `## 라이너 스콜라 메모\n\n\`\`\`md\n## not a heading\n\`\`\`\n\n${BLOCK}\n\n## 다음\n`,
    );
  });

  it("normalises CRLF bodies", () => {
    expect(appendLinerMemo("## 라이너 스콜라 메모\r\n\r\n", BLOCK)).toBe(
      `## 라이너 스콜라 메모\n\n${BLOCK}\n`,
    );
  });
});

describe("appendLinerMemoEntry / formatLocalDate", () => {
  it("stamps the local date", () => {
    const now = new Date(2026, 0, 5, 23, 30);
    expect(formatLocalDate(now)).toBe("2026-01-05");
    expect(appendLinerMemoEntry("", { kind: "summary", text: "요약" }, now)).toContain(
      "### 요약 · 2026-01-05",
    );
  });
});

describe("validateLinerMemoInput", () => {
  it("reports the first problem", () => {
    expect(validateLinerMemoInput({ kind: "answer", text: "x" })).toBeNull();
    expect(validateLinerMemoInput({ kind: "answer", text: "x", sourceUrl: "" })).toBeNull();
    expect(validateLinerMemoInput({ kind: "bogus", text: "x" })).toBe("kind");
    expect(validateLinerMemoInput({ kind: "answer", text: "  " })).toBe("empty");
    expect(validateLinerMemoInput({ kind: "answer", text: 3 })).toBe("empty");
    expect(
      validateLinerMemoInput({ kind: "answer", text: "x".repeat(MAX_LINER_MEMO_TEXT + 1) }),
    ).toBe("too_long");
    expect(validateLinerMemoInput({ kind: "answer", text: "x", sourceUrl: "liner.com" })).toBe(
      "source_url",
    );
  });
});

describe("buildLinerSearchUrl", () => {
  it("opens the confirmed Scholar page and never puts the title in the URL", () => {
    expect(buildLinerSearchUrl("Attention Is All You Need")).toBe(LINER_SCHOLAR_URL);
    expect(LINER_SCHOLAR_URL).toBe("https://liner.com/scholar");
  });
});
