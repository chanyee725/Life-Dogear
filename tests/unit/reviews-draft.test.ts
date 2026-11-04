import { describe, expect, it } from "vitest";
import { DRAFT_LIST_LIMIT, plainTitle, weekDigestMarkdown } from "@/lib/reviews/draft";
import { extractWikiTitles } from "@/lib/wikilinks";

const empty = { doneTasks: [], finishedProjects: [], created: [] };

describe("weekly review draft digest", () => {
  it("is empty when nothing happened", () => {
    expect(weekDigestMarkdown(empty)).toBe("");
  });

  it("lists done tasks, finished projects and new items in plain text, in that order", () => {
    const md = weekDigestMarkdown({
      doneTasks: [{ title: "2장 초안", parentTitle: "논문 A 작성" }, { title: "장비 신청" }],
      finishedProjects: [{ title: "데이터 정리" }],
      created: [
        { type: "goal", title: "학위 1장" },
        { type: "thought", title: "  모델   크기 " },
        { type: "paper", title: "Attention" },
        { type: "thought", title: "두 번째 생각" },
        { type: "note", title: "3장 노트" },
      ],
    });
    expect(md).toBe(
      [
        "## 이번 주 모음",
        "",
        "### 완료한 할 일 2",
        "- 2장 초안 — 논문 A 작성",
        "- 장비 신청",
        "",
        "### 끝난 프로젝트 1",
        "- 데이터 정리",
        "",
        "### 새로 만든 항목 5",
        "- 논문 · Attention",
        "- 노트 · 3장 노트",
        "- 생각 · 모델 크기",
        "- 생각 · 두 번째 생각",
        "- 목표 · 학위 1장",
        "",
        "",
      ].join("\n"),
    );
  });

  it("drops empty groups and caps each at 15 lines", () => {
    const created = Array.from({ length: DRAFT_LIST_LIMIT + 3 }, (_, i) => ({
      type: "thought" as const,
      title: `t${i}`,
    }));
    const md = weekDigestMarkdown({ ...empty, created });
    expect(md).not.toContain("완료한 할 일");
    expect(md).not.toContain("끝난 프로젝트");
    expect(md).toContain(`### 새로 만든 항목 ${DRAFT_LIST_LIMIT + 3}`);
    expect(md).toContain(`- 생각 · t${DRAFT_LIST_LIMIT - 1}\n- 외 3개`);
  });

  it("escapes markdown so titles never become links, emphasis or headings", () => {
    expect(plainTitle("# a *b* _c_ [x]")).toBe("\\# a \\*b\\* \\_c\\_ \\[x\\]");
    const md = weekDigestMarkdown({
      ...empty,
      doneTasks: [{ title: "[[몰래]] 링크", parentTitle: "[[부모]]" }],
    });
    expect(extractWikiTitles(md)).toEqual([]);
  });
});
