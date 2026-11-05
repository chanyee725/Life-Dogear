import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GoalDirection } from "@/app/goals/GoalDirection";
import type { ListGoal } from "@/app/goals/list-view";

const life: ListGoal = {
  id: "g1",
  title: "건강하게 오래 연구하기",
  horizon: "life",
  period: null,
  status: "active",
  progress: null,
  projectCount: 0,
  areaId: null,
  children: [],
};

describe("GoalDirection", () => {
  it("shows the life goals card", () => {
    const html = renderToStaticMarkup(createElement(GoalDirection, { goals: [life] }));
    expect(html).toContain('aria-label="인생 목표"');
    expect(html).toContain('href="/goals/g1"');
  });

  it("renders nothing without life goals (no '＋ 인생 목표' box)", () => {
    expect(renderToStaticMarkup(createElement(GoalDirection, { goals: [] }))).toBe("");
  });
});
