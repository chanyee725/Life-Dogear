import { describe, expect, it } from "vitest";
import {
  findNode,
  flatten,
  PRIORITIES,
  PRIORITY_LABEL,
  ratio,
  splitSides,
  stageStatus,
  STATUS_LABEL,
  STATUSES,
  treeKeyAction,
  visibleNodes,
  type LearningRoadmap,
  type RoadmapNode,
} from "@/app/roadmap/model";
import { assembleNodes, type RoadmapNodeRow } from "@/lib/repo/learningRoadmap";

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
const stage = (children: RoadmapNode[], id = "s"): RoadmapNode => ({
  ...node(id, "todo", children),
  kind: "stage",
  priority: null,
});

const row = (
  id: string,
  parentId: string | null,
  position: number,
  status: RoadmapNodeRow["status"] = "todo",
): RoadmapNodeRow => ({
  id,
  parentId,
  kind: parentId === null ? "stage" : "item",
  title: id,
  description: "",
  priority: parentId === null ? null : "essential",
  resources: "[]",
  status,
  position,
});

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
    expect(splitSides([1, 2])).toEqual({ left: [1], right: [2] });
    expect(splitSides([])).toEqual({ left: [], right: [] });
  });

  it("flattens depth first, parents before children", () => {
    const tree = [stage([node("a", "todo", [node("a1", "todo")]), node("b", "todo")], "s1"), stage([], "s2")];
    expect(flatten(tree).map((n) => n.id)).toEqual(["s1", "a", "a1", "b", "s2"]);
  });

  it("finds a node at any depth", () => {
    const roadmap = {
      stages: [stage([node("a", "todo", [node("deep", "done")])])],
    } as LearningRoadmap;
    expect(findNode(roadmap, "deep")?.status).toBe("done");
    expect(findNode(roadmap, "s")?.kind).toBe("stage");
    expect(findNode(roadmap, "missing")).toBeUndefined();
  });

  it("labels every priority and status", () => {
    expect(PRIORITIES.map((p) => PRIORITY_LABEL[p])).toEqual(["필수", "추천", "선택"]);
    expect(STATUSES.map((s) => STATUS_LABEL[s])).toEqual(["할 일", "진행 중", "완료"]);
  });
});

describe("learning roadmap progress", () => {
  it("ratio is 0 for an empty subtree", () => {
    expect(ratio({ done: 0, total: 0 })).toBe(0);
    expect(ratio({ done: 1, total: 4 })).toBe(0.25);
    expect(ratio({ done: 3, total: 3 })).toBe(1);
  });

  it("counts items at every depth, not stages", () => {
    const { stages, progress } = assembleNodes([
      row("s1", null, 0),
      row("a", "s1", 0, "done"),
      row("a1", "a", 0, "done"),
      row("a2", "a", 1, "doing"),
      row("s2", null, 1),
      row("b", "s2", 0, "todo"),
    ]);
    expect(progress).toEqual({ done: 2, total: 4 });
    expect(stages.map((s) => s.progress)).toEqual([
      { done: 2, total: 3 },
      { done: 0, total: 1 },
    ]);
    // An item's own progress counts only what is below it.
    expect(stages[0].children[0].progress).toEqual({ done: 1, total: 2 });
    expect(stages[0].children[0].children[0].progress).toEqual({ done: 0, total: 0 });
  });

  it("orders siblings by position and drops orphans", () => {
    const { stages, progress } = assembleNodes([
      row("s", null, 0),
      row("second", "s", 1, "done"),
      row("first", "s", 0),
      row("orphan", "gone", 0, "done"),
    ]);
    expect(stages[0].children.map((c) => c.id)).toEqual(["first", "second"]);
    expect(progress).toEqual({ done: 1, total: 2 });
  });

  it("an empty roadmap has zero progress", () => {
    expect(assembleNodes([])).toEqual({ stages: [], progress: { done: 0, total: 0 } });
  });
});

describe("visibleNodes / treeKeyAction", () => {
  const tree = [
    stage([node("a", "todo", [node("a1", "todo", [node("a11", "todo")])]), node("b", "done")], "s1"),
    stage([node("c", "todo")], "s2"),
  ];
  const ids = (folded: string[]) => visibleNodes(tree, new Set(folded)).map((r) => r.id);

  it("walks only unfolded branches", () => {
    expect(ids(["a"])).toEqual(["s1", "a", "b", "s2", "c"]);
    expect(ids([])).toEqual(["s1", "a", "a1", "a11", "b", "s2", "c"]);
    expect(ids(["s1", "s2"])).toEqual(["s1", "s2"]);
    const a11 = visibleNodes(tree, new Set()).find((r) => r.id === "a11")!;
    expect([a11.level, a11.parentId, a11.stageIndex]).toEqual([4, "a1", 0]);
  });

  it("arrow keys follow the WAI-ARIA tree pattern", () => {
    const rows = visibleNodes(tree, new Set(["a"]));
    expect(treeKeyAction(rows, "a", "ArrowDown")).toEqual({ type: "focus", id: "b" });
    expect(treeKeyAction(rows, "a", "ArrowUp")).toEqual({ type: "focus", id: "s1" });
    expect(treeKeyAction(rows, "a", "ArrowRight")).toEqual({ type: "expand", id: "a" });
    expect(treeKeyAction(rows, "s1", "ArrowRight")).toEqual({ type: "focus", id: "a" });
    expect(treeKeyAction(rows, "s1", "ArrowLeft")).toEqual({ type: "collapse", id: "s1" });
    expect(treeKeyAction(rows, "b", "ArrowLeft")).toEqual({ type: "focus", id: "s1" });
    expect(treeKeyAction(rows, "b", "Home")).toEqual({ type: "focus", id: "s1" });
    expect(treeKeyAction(rows, "b", "End")).toEqual({ type: "focus", id: "c" });
    expect(treeKeyAction(rows, "b", "Enter")).toEqual({ type: "open", id: "b" });
    expect(treeKeyAction(rows, "c", "ArrowDown")).toBeNull();
    expect(treeKeyAction(rows, "c", "x")).toBeNull();
  });
});
