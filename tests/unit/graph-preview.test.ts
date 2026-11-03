import { describe, expect, it } from "vitest";
import {
  areaPreview,
  firstParagraph,
  goalPreview,
  paperPreview,
  projectPreview,
  reviewPreview,
  seminarPreview,
  thoughtPreview,
} from "@/app/graph/preview/build";

describe("firstParagraph", () => {
  it("returns the first non-empty paragraph as plain text", () => {
    expect(
      firstParagraph(
        "# 제목\n\n**굵게** 쓴 [[다른 노트]]와 [링크](http://x).\n둘째 줄\n\n다음 문단",
      ),
    ).toBe("굵게 쓴 다른 노트와 링크. 둘째 줄");
    expect(firstParagraph("```\ncode\n\nmore code\n```\n\n- [ ] 할 일 하나")).toBe("할 일 하나");
    expect(firstParagraph("> 인용한 문장")).toBe("인용한 문장");
    expect(firstParagraph("")).toBeUndefined();
    expect(firstParagraph("\n\n   \n")).toBeUndefined();
  });

  it("cuts to 160 characters", () => {
    const text = firstParagraph("가".repeat(300))!;
    expect(text).toHaveLength(160);
    expect(text.endsWith("…")).toBe(true);
  });
});

describe("previews", () => {
  it("project: stage for research, status for general, next action first", () => {
    const base = {
      kind: "research",
      status: "active",
      stage: "drafting",
      dueDate: "2027-03-01",
      nextAction: "",
      researchQuestion: "무엇을 묻나",
      body: "",
      archivedAt: null,
    };
    expect(projectPreview(base)).toEqual({
      archived: false,
      props: [
        { label: "단계", value: "초안 작성" },
        { label: "마감일", value: "2027-03-01" },
      ],
      summary: "무엇을 묻나",
    });
    const general = projectPreview({
      ...base,
      kind: "general",
      dueDate: null,
      nextAction: "메일 보내기",
      archivedAt: "x",
    });
    expect(general.props).toEqual([{ label: "상태", value: "진행 중" }]);
    expect(general.summary).toBe("다음 할 일: 메일 보내기");
    expect(general.archived).toBe(true);
  });

  it("paper: authors (shortened), year, read status, summary", () => {
    const p = paperPreview({
      authors: ["김가", "이나", "박다"],
      year: 2024,
      readStatus: "reading",
      summary: "한 줄 요약",
      body: "본문",
      archivedAt: null,
    });
    expect(p.props).toEqual([
      { label: "저자", value: "김가, 이나 외 1명" },
      { label: "연도", value: "2024" },
      { label: "읽기", value: "읽는 중" },
    ]);
    expect(p.summary).toBe("한 줄 요약");
  });

  it("seminar, thought and area", () => {
    const s = seminarPreview({
      date: "2026-11-01",
      speaker: "",
      kind: "lecture",
      keyLine: "",
      body: "첫 문단",
      archivedAt: null,
    });
    expect(s).toEqual({
      archived: false,
      badge: "강의",
      props: [{ label: "날짜", value: "2026-11-01" }],
      summary: "첫 문단",
    });
    const t = thoughtPreview({ kind: "question", maturity: "seed", body: "", archivedAt: null });
    expect(t.props).toEqual([
      { label: "종류", value: "질문" },
      { label: "발전", value: "씨앗" },
    ]);
    expect(t.summary).toBeUndefined();
    expect(areaPreview({ standard: "주 1회 점검", body: "", archivedAt: null }, 3)).toEqual({
      archived: false,
      props: [{ label: "프로젝트", value: "3개" }],
      summary: "주 1회 점검",
    });
  });
});

describe("goal and review previews", () => {
  const goal = {
    horizon: "quarter",
    period: "2027-Q1",
    status: "active",
    why: "학회 마감 전에",
    body: "",
    archivedAt: null,
  };

  it("goal: progress, period, parent and area; why as summary", () => {
    expect(
      goalPreview(goal, { progress: 66.7, parentTitle: "1저자 논문", areaTitle: "연구 분야" }),
    ).toEqual({
      archived: false,
      badge: "분기 목표 2027-Q1",
      props: [
        { label: "진행률", value: "67%" },
        { label: "기간", value: "2027-Q1" },
        { label: "상위", value: "1저자 논문" },
        { label: "영역", value: "연구 분야" },
      ],
      summary: "학회 마감 전에",
    });
  });

  it("life goal: no progress or period; non-active status shown", () => {
    const p = goalPreview(
      { ...goal, horizon: "life", period: null, status: "dropped", why: "", body: "방향만 둔다" },
      { progress: null },
    );
    expect(p.badge).toBe("인생 목표");
    expect(p.props).toEqual([{ label: "상태", value: "내려놓음" }]);
    expect(p.summary).toBe("방향만 둔다");
  });

  it("review: period and done state", () => {
    const base = {
      kind: "week",
      period: "2026-W45",
      completedAt: null,
      body: "",
      archivedAt: null,
    };
    expect(reviewPreview(base)).toEqual({
      archived: false,
      badge: "주간 회고",
      props: [
        { label: "기간", value: "2026-W45" },
        { label: "상태", value: "작성 중" },
      ],
      summary: undefined,
    });
    expect(reviewPreview({ ...base, completedAt: "2026-11-08T10:00:00.000Z" }).props[1]).toEqual({
      label: "상태",
      value: "완료 2026-11-08",
    });
  });
});
