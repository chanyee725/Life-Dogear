import { describe, expect, it } from "vitest";
import { cleanTitle, extractWikiTitles, renameWikiTitle, titleKey } from "@/lib/wikilinks";

describe("extractWikiTitles", () => {
  it("finds links, dedupes case-insensitively and trims", () => {
    expect(extractWikiTitles("읽은 [[논문 A]]와 [[ 논문 a ]], 그리고 [[생각 B]].")).toEqual([
      "논문 A",
      "생각 B",
    ]);
    expect(extractWikiTitles("escaped \\[\\[목표\\]\\] too")).toEqual(["목표"]);
    expect(extractWikiTitles("[[]] [[ ]] [[a\nb]] [[x [[y]]")).toEqual(["y"]);
  });

  it("ignores code blocks, inline code and quotes", () => {
    const body = [
      "본문 [[살아 있음]]",
      "```",
      "[[코드 안]]",
      "```",
      "인라인 `[[코드]]` 와 ``a ` [[둘]]`` 뒤 [[뒤]]",
      "> 인용 [[라이너 인용]]",
      "  > 들여쓴 인용 [[인용2]]",
      "~~~ts",
      "[[물결]]",
      "~~~",
      "- 목록 [[목록]]",
      "| 표 | [[표 칸]] |",
    ].join("\n");
    expect(extractWikiTitles(body)).toEqual(["살아 있음", "뒤", "목록", "표 칸"]);
  });

  it("keeps an unclosed fence dead to the end", () => {
    expect(extractWikiTitles("[[a]]\n```\n[[b]]")).toEqual(["a"]);
  });
});

describe("renameWikiTitle", () => {
  it("renames live links only, any case or escape", () => {
    const body = "[[옛 제목]] \\[\\[옛  제목\\]\\] [[옛 제목 2]]\n`[[옛 제목]]`\n> [[옛 제목]]";
    expect(renameWikiTitle(body, "옛 제목", "새 (제목)")).toEqual({
      body: "[[새 (제목)]] [[새 (제목)]] [[옛 제목 2]]\n`[[옛 제목]]`\n> [[옛 제목]]",
      count: 2,
    });
    expect(renameWikiTitle("[[a.b]] [[axb]]", "a.b", "c")).toEqual({
      body: "[[c]] [[axb]]",
      count: 1,
    });
  });
});

describe("title helpers", () => {
  it("normalizes", () => {
    expect(titleKey(" ABC ")).toBe("abc");
    expect(titleKey("방법론".normalize("NFD"))).toBe(titleKey("방법론"));
    expect(cleanTitle("  a   b ")).toBe("a b");
    expect(cleanTitle("   ")).toBeNull();
  });
});
