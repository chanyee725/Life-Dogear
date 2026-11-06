import { describe, expect, it } from "vitest";
import {
  countAll,
  countDescendants,
  formatRoadmapDate,
  highlightSet,
  progressPercent,
  projectStatusLabel,
  relativesIndex,
  statusLabel,
} from "@/app/roadmap/roadmapStats";
import type { RoadmapKind, RoadmapNode } from "@/lib/repo/roadmap-types";

function n(
  kind: RoadmapKind,
  id: string,
  children: RoadmapNode[] = [],
  extra: Partial<RoadmapNode> = {},
): RoadmapNode {
  return { kind, id, title: id, href: null, status: null, progress: null, due: null, children, ...extra };
}

const t1 = n("task", "t1", [], { done: true });
const t2 = n("task", "t2", [], { done: false });
const p1 = n("project", "p1", [t1, t2]);
const p2 = n("project", "p2", [], { progress: 0.456, status: "on_hold" });
const g1 = n("goal", "g1", [p1, p2]);
const g0 = n("goal", "g0", [g1], { status: "achieved" });
const a1 = n("area", "a1", [g0]);

describe("counts", () => {
  it("counts goals/projects/tasks at any depth", () => {
    expect(countDescendants(a1)).toEqual({ goals: 2, projects: 2, tasks: 2 });
    expect(countDescendants(p2)).toEqual({ goals: 0, projects: 0, tasks: 0 });
  });
  it("countAll skips tasks", () => {
    const m = countAll([a1]);
    expect(m.get("goal-g1")).toEqual({ goals: 0, projects: 2, tasks: 2 });
    expect(m.has("task-t1")).toBe(false);
  });
});

describe("progressPercent", () => {
  it("uses the progress field", () => expect(progressPercent(p2)).toBe(46));
  it("falls back to done tasks", () => expect(progressPercent(p1)).toBe(50));
  it("goal without field counts nested tasks", () => expect(progressPercent(g1)).toBe(50));
  it("null when nothing to measure", () => {
    expect(progressPercent(n("project", "x"))).toBeNull();
    expect(progressPercent(a1)).toBeNull();
    expect(progressPercent(t1)).toBeNull();
  });
  it("clamps", () => expect(progressPercent(n("goal", "y", [], { progress: 1.4 }))).toBe(100));
});

describe("labels", () => {
  it("project status in Korean", () => {
    expect(projectStatusLabel("active")).toBe("진행 중");
    expect(projectStatusLabel("on_hold")).toBe("보류");
    expect(projectStatusLabel(null)).toBe("");
    expect(projectStatusLabel("weird")).toBe("weird");
  });
  it("statusLabel by kind", () => {
    expect(statusLabel(p2)).toBe("보류");
    expect(statusLabel(g0)).toBe("달성");
    expect(statusLabel(a1)).toBe("");
  });
});

describe("formatRoadmapDate", () => {
  it("formats dates, passes periods through", () => {
    expect(formatRoadmapDate("2026-11-06")).toBe("2026.11.06");
    expect(formatRoadmapDate("2027-Q1")).toBe("2027-Q1");
    expect(formatRoadmapDate("2027")).toBe("2027");
    expect(formatRoadmapDate(null)).toBe("");
  });
});

describe("relativesIndex", () => {
  const idx = relativesIndex([a1]);
  it("ancestors and descendants", () => {
    expect([...idx.get("project-p1")!.ancestors]).toEqual(["area-a1", "goal-g0", "goal-g1"]);
    expect([...idx.get("project-p1")!.descendants].sort()).toEqual(["task-t1", "task-t2"]);
    expect(idx.get("goal-g0")!.descendants.size).toBe(5);
    expect(idx.get("area-a1")!.ancestors.size).toBe(0);
  });
  it("highlightSet includes self", () => {
    const s = highlightSet(idx, "goal-g1");
    expect([...s].sort()).toEqual(
      ["area-a1", "goal-g0", "goal-g1", "project-p1", "project-p2", "task-t1", "task-t2"].sort(),
    );
    expect([...highlightSet(idx, "missing")]).toEqual(["missing"]);
  });
});
