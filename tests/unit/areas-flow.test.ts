import { describe, expect, it } from "vitest";
import { goalOrder, groupProjectsByGoal, viaLabel } from "@/app/areas/flow";
import type { GoalNode } from "@/lib/repo/goals";

const node = (id: string, children: GoalNode[] = []) =>
  ({ goal: { id }, children, projects: [], progress: null }) as unknown as GoalNode;

describe("area flow helpers", () => {
  it("labels paths", () => {
    expect(
      viaLabel([
        { type: "area" },
        { type: "project", id: "p", title: "X" },
        { type: "goal", id: "g", title: "Y" },
      ]),
    ).toBe("직접 연결 · 프로젝트 X 경유 · 목표 Y 경유");
    expect(viaLabel([{ type: "member" }, { type: "area" }])).toBe("영역 소속 · 직접 연결");
  });

  it("groups projects by goal: area goals in tree order, other goals, then none", () => {
    const order = goalOrder([node("y", [node("q1"), node("q2")])]);
    expect(order).toEqual(["y", "q1", "q2"]);
    const titles = new Map([
      ["y", "연"],
      ["q1", "분기1"],
      ["q2", "분기2"],
      ["other", "가 다른 영역 목표"],
    ]);
    const p = (id: string, goalId: string | null) => ({ id, goalId });
    const groups = groupProjectsByGoal(
      [p("a", null), p("b", "q2"), p("c", "other"), p("d", "q2"), p("e", "y"), p("f", "gone")],
      order,
      titles,
    );
    expect(groups.map((g) => [g.goalId, g.title, g.projects.map((x) => x.id)])).toEqual([
      ["y", "연", ["e"]],
      ["q2", "분기2", ["b", "d"]],
      ["other", "가 다른 영역 목표", ["c"]],
      [null, null, ["a", "f"]],
    ]);
  });
});
