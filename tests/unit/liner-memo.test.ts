import { describe, expect, it } from "vitest";
import {
  appendLinerMemo,
  appendLinerMemoEntry,
  buildLinerSearchUrl,
  formatLinerMemo,
  sourceLabel,
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
        "출처: [liner.com](https://liner.com/review/abc%281%29%20x)",
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

describe("sourceLabel", () => {
  it("shows the real host, so non-Liner links never read as Liner", () => {
    expect(sourceLabel("https://liner.com/x")).toBe("liner.com");
    expect(sourceLabel("https://www.liner.com/x")).toBe("liner.com");
    expect(sourceLabel("https://getliner.com/a")).toBe("getliner.com");
    expect(sourceLabel("https://example.org/liner")).toBe("example.org");
    expect(sourceLabel("http://[::1]:3000/x")).toBe("\\[::1\\]");
    // Hostnames may legally contain * _ ~ ` (the URL parser keeps them).
    expect(sourceLabel("https://my_site*x~y`z.example/p")).toBe("my\\_site\\*x\\~y\\`z.example");
    // IDN hosts come out as ASCII punycode (no lookalike Hangul "라이너" text).
    expect(sourceLabel(new URL("https://라이너.example/x").href)).toMatch(
      /^xn--[a-z0-9-]+\.example$/,
    );
  });

  it("is used as the link text of the source line", () => {
    const block = formatLinerMemo({
      kind: "answer",
      text: "답",
      date: "2026-11-02",
      sourceUrl: "https://example.org/page",
    });
    expect(block.endsWith("출처: [example.org](https://example.org/page)")).toBe(true);
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

  it.each([
    ["a shorter run", "````\n```\n## 라이너 스콜라 메모\n````\n"],
    ["the other fence character", "```\n~~~\n## 라이너 스콜라 메모\n```\n"],
    ["a run followed by text", "~~~\n~~~ not closing\n## 라이너 스콜라 메모\n~~~\n"],
  ])("does not close a fence on %s", (_label, body) => {
    // The look-alike heading stays inside the fence, so a new section is added at the end.
    const out = appendLinerMemo(body, BLOCK);
    expect(out.startsWith(body.trimEnd())).toBe(true);
    expect(out.endsWith(`\n\n${LINER_SECTION_HEADING}\n\n${BLOCK}\n`)).toBe(true);
  });

  it("closes a fence on a longer run of the same character", () => {
    const body = "```\ncode\n`````\n\n## 라이너 스콜라 메모\n\n### 이전\n";
    expect(appendLinerMemo(body, BLOCK)).toBe(`${body.trimEnd()}\n\n${BLOCK}\n`);
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
