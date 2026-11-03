import { describe, expect, it } from "vitest";
import { DRAFT_LIST_LIMIT, weekDigestMarkdown, wikiRef } from "@/lib/reviews/draft";
import { extractWikiTitles } from "@/lib/wikilinks";

describe("weekly review draft digest", () => {
  it("is empty when nothing happened", () => {
    expect(weekDigestMarkdown({ created: [], doneTasks: [], finishedProjects: [] })).toBe("");
  });

  it("lists made items, done tasks and finished projects as [[links]]", () => {
    const md = weekDigestMarkdown({
      created: [{ title: "새 논문" }, { title: "  여러   칸 " }],
      doneTasks: [{ title: "그림 3 고치기", parentTitle: "학회 제출" }, { title: "메일 답장" }],
      finishedProjects: [{ title: "학회 제출" }],
    });
    expect(md).toBe(
      [
        "## 이번 주 모음",
        "",
        "### 만든 항목",
        "",
        "- [[새 논문]]",
        "- [[여러 칸]]",
        "",
        "### 완료한 할 일",
        "",
        "- 그림 3 고치기 · [[학회 제출]]",
        "- 메일 답장",
        "",
        "### 끝난 프로젝트",
        "",
        "- [[학회 제출]]",
        "",
        "",
      ].join("\n"),
    );
    expect(md.startsWith("## 이번 주 모음")).toBe(true);
  });

  it("skips empty sections and caps long lists", () => {
    const created = Array.from({ length: DRAFT_LIST_LIMIT + 3 }, (_, i) => ({ title: `t${i}` }));
    const md = weekDigestMarkdown({ created, doneTasks: [], finishedProjects: [] });
    expect(md).not.toContain("완료한 할 일");
    expect(md).not.toContain("끝난 프로젝트");
    expect(md).toContain(`- [[t${DRAFT_LIST_LIMIT - 1}]]`);
    expect(md).not.toContain(`[[t${DRAFT_LIST_LIMIT}]]`);
    expect(md).toContain("- 외 3개");
  });

  it("never writes a broken or accidental link", () => {
    expect(wikiRef("a [b] c")).toBe("a [b] c");
    expect(wikiRef("x".repeat(301))).toBe("x".repeat(301));
    const md = weekDigestMarkdown({
      created: [{ title: "[[몰래]] 링크" }],
      doneTasks: [{ title: "[[할 일]] 제목" }],
      finishedProjects: [],
    });
    expect(extractWikiTitles(md)).toEqual([]);
  });
});
