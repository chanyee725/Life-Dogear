import { describe, expect, it } from "vitest";
import { canReplaceBody, chooseTemplate, initialChoice } from "@/components/ui/template-choice";
import {
  defaultProjectBody,
  defaultProjectTemplate,
  PROJECT_TEMPLATE,
  PROJECT_TEMPLATES,
  projectKindAfter,
  projectTemplate,
  type ProjectTemplateKey,
} from "@/lib/templates";

const headings = (md: string) =>
  md
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3));

describe("project templates", () => {
  it("offers five templates in picker order, 빈 페이지 first", () => {
    expect(PROJECT_TEMPLATES.map((t) => [t.key, t.name, t.kind])).toEqual([
      ["blank", "빈 페이지", null],
      ["research", "연구(논문)", "research"],
      ["general", "일반 프로젝트", "general"],
      ["study", "공부", "general"],
      ["dev", "개발", "general"],
    ]);
    expect(projectTemplate("blank").body).toBe("");
    expect(projectTemplate("research").body).toBe(PROJECT_TEMPLATE);
  });

  it("each template has its sections, starting at ## with checklists", () => {
    expect(headings(projectTemplate("general").body)).toEqual([
      "목표·완료 기준",
      "범위",
      "마일스톤",
      "리스크·의존성",
      "메모",
    ]);
    expect(headings(projectTemplate("study").body)).toEqual([
      "배우려는 것",
      "자료",
      "커리큘럼",
      "실습·과제",
      "정리 노트",
      "회고",
    ]);
    expect(projectTemplate("study").body).toContain("[[ ]]");
    expect(headings(projectTemplate("dev").body)).toEqual([
      "목표·요구사항",
      "환경·설치",
      "설계 메모",
      "작업",
      "이슈·에러 로그",
      "참고 링크",
    ]);
    expect(projectTemplate("dev").body).toContain("| 날짜 | 증상 | 원인 | 해결 |");
    for (const t of PROJECT_TEMPLATES) {
      expect(t.body).not.toMatch(/^# /m);
      if (t.key !== "blank") expect(t.body).toContain("- [ ] ");
    }
  });

  it("?kind=general preselects 일반 프로젝트, anything else 연구(논문)", () => {
    expect(defaultProjectTemplate("general")).toBe("general");
    expect(defaultProjectTemplate("research")).toBe("research");
    expect(defaultProjectBody("research")).toBe(PROJECT_TEMPLATE);
    expect(defaultProjectBody("general")).toBe(projectTemplate("general").body);
  });
});

describe("project template choice", () => {
  it("a template sets 종류; 빈 페이지 keeps the current one", () => {
    expect(projectKindAfter("research", "general")).toBe("research");
    expect(projectKindAfter("dev", "research")).toBe("general");
    expect(projectKindAfter("study", "research")).toBe("general");
    expect(projectKindAfter("blank", "research")).toBe("research");
    expect(projectKindAfter("blank", "general")).toBe("general");
  });

  it("applies a template over the untouched default, never over the user's text", () => {
    const research = projectTemplate("research").body;
    let state = initialChoice<ProjectTemplateKey>(defaultProjectTemplate("research"));

    state = chooseTemplate(state, "dev", canReplaceBody(research, research));
    expect(state).toMatchObject({ selected: "dev", applied: "dev", revision: 1, skipped: false });

    const edited = `${projectTemplate("dev").body}\nROS2 MoveIt2 설치 완료`;
    state = chooseTemplate(state, "study", canReplaceBody(edited, projectTemplate("dev").body));
    expect(state).toMatchObject({ selected: "study", applied: "dev", revision: 1, skipped: true });

    state = chooseTemplate(state, "blank", canReplaceBody("", null));
    expect(state).toMatchObject({ selected: "blank", applied: "blank", revision: 2 });
    expect(projectTemplate(state.applied).body).toBe("");
  });
});
