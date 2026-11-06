import { describe, expect, it } from "vitest";
import { splitSides, stageStatus, type RoadmapNode } from "@/app/roadmap/model";

const node = (id: string, status: RoadmapNode["status"], children: RoadmapNode[] = []): RoadmapNode => ({
  id,
  kind: "item",
  title: id,
  description: "",
  priority: "essential",
  resources: [],
  status,
  progress: { done: 0, total: 0 },
  children,
});
const stage = (children: RoadmapNode[]) => ({ ...node("s", "todo", children), kind: "stage" as const });

describe("learning roadmap model", () => {
  it("derives stage status from its items", () => {
    expect(stageStatus(stage([]))).toBe("todo");
    expect(stageStatus(stage([node("a", "todo")]))).toBe("todo");
    expect(stageStatus(stage([node("a", "doing")]))).toBe("doing");
    expect(stageStatus(stage([node("a", "done", [node("b", "todo")])]))).toBe("doing");
    expect(stageStatus(stage([node("a", "done", [node("b", "done")])]))).toBe("done");
  });

  it("puts the extra item on the left", () => {
    expect(splitSides([1, 2, 3])).toEqual({ left: [1, 2], right: [3] });
    expect(splitSides([])).toEqual({ left: [], right: [] });
  });
});
