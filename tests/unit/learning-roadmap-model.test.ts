import { describe, expect, it } from "vitest";
import { progressOf, splitSides, stageStatus, type RoadmapItem } from "@/app/roadmap/model";

const item = (id: string, status: RoadmapItem["status"], children: RoadmapItem[] = []): RoadmapItem => ({
  id,
  title: id,
  description: null,
  priority: "essential",
  status,
  resources: [],
  children,
});

describe("learning roadmap model", () => {
  it("counts children in progress", () => {
    expect(progressOf([item("a", "done", [item("b", "todo")]), item("c", "done")])).toEqual({
      done: 2,
      total: 3,
    });
  });

  it("derives stage status", () => {
    expect(stageStatus([])).toBe("todo");
    expect(stageStatus([item("a", "todo")])).toBe("todo");
    expect(stageStatus([item("a", "doing")])).toBe("doing");
    expect(stageStatus([item("a", "done", [item("b", "todo")])])).toBe("doing");
    expect(stageStatus([item("a", "done", [item("b", "done")])])).toBe("done");
  });

  it("puts the extra item on the left", () => {
    expect(splitSides([1, 2, 3])).toEqual({ left: [1, 2], right: [3] });
    expect(splitSides([])).toEqual({ left: [], right: [] });
  });
});
