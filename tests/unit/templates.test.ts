import { describe, expect, it } from "vitest";
import { PAPER_TEMPLATE, PROJECT_TEMPLATE, SEMINAR_TEMPLATE } from "@/lib/templates";

const headings = (md: string) =>
  md
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3));

describe("templates", () => {
  it("paper template has the SPEC sections in order", () => {
    expect(headings(PAPER_TEMPLATE)).toEqual([
      "왜 읽나",
      "핵심 내용",
      "방법론",
      "주요 결과",
      "한계",
      "인용할 부분",
      "내 생각",
      "라이너 스콜라 메모",
    ]);
    expect(PAPER_TEMPLATE).toContain("### 연구 질문");
  });

  it("seminar template has the SPEC sections in order", () => {
    expect(headings(SEMINAR_TEMPLATE)).toEqual([
      "현장 메모",
      "핵심 3가지",
      "인상 깊은 점",
      "남은 질문",
      "언급된 논문",
      "내 연구에 적용할 것",
    ]);
  });

  it("project template has checklist, comparison table, draft outline and feedback log", () => {
    expect(headings(PROJECT_TEMPLATE)).toEqual([
      "진행 체크리스트",
      "후보 주제 비교표",
      "초안 구조",
      "피드백 기록",
    ]);
    expect(PROJECT_TEMPLATE).toContain("- [ ] 제출 완료");
    expect(PROJECT_TEMPLATE).toContain("### 초록");
    expect(PROJECT_TEMPLATE).toContain("### 참고문헌");
  });
});
