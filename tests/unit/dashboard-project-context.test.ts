import { describe, expect, it } from "vitest";
import { projectContext, projectProgress } from "@/components/dashboard/today";
import type { GoalNode } from "@/lib/repo/goals";

const goal = (id: string, title: string, children: GoalNode[] = []): GoalNode =>
  ({ goal: { id, title }, progress: null, children, projects: [] }) as unknown as GoalNode;

describe("projectContext", () => {
  const tree = [goal("g1", "연간 목표", [goal("g2", "분기 목표")])];
  const areas = [{ id: "a1", title: "연구" }];

  it("prefers the goal title (nested too), falls back to the area, skips unknowns", () => {
    expect(
      projectContext(
        [
          { id: "p1", goalId: "g2", areaId: "a1" },
          { id: "p2", goalId: null, areaId: "a1" },
          { id: "p3", goalId: "gone", areaId: null },
          { id: "p4", goalId: null, areaId: null },
          { id: "p5", goalId: "gone", areaId: "a1" },
        ],
        tree,
        areas,
      ),
    ).toEqual({ p1: "분기 목표", p2: "연구", p5: "연구" });
  });
});

describe("projectProgress", () => {
  it("re-keys project counts by id", () => {
    expect(
      projectProgress(["p1", "p2"], {
        "project:p1": { done: 1, total: 3 },
        "goal:p2": { done: 9, total: 9 },
      }),
    ).toEqual({ p1: { done: 1, total: 3 } });
  });
});
