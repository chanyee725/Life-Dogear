import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  graphQuery,
  labelPriority,
  labelText,
  nodeHref,
  nodeRadius,
  normalizeFilter,
  paraColumns,
  paraTargetX,
  paraXByType,
  parsePageQuery,
  TASK_COLUMN_OFFSET,
} from "@/components/graph/model";
import { buildGraph, buildLocalGraph, type GraphSource } from "@/lib/graph/build";
import { parseGraphFilter } from "@/lib/graph/query";

const SOURCE: GraphSource = {
  items: [
    { type: "project", id: "p", title: "논문 A", archived: false },
    { type: "goal", id: "g", title: "학위", archived: false, horizon: "quarter" },
    { type: "area", id: "old", title: "보관 영역", archived: true },
    { type: "paper", id: "x", title: "x", archived: false },
  ],
  links: [],
  tasks: [
    {
      id: "t1",
      title: "2장 초안",
      done: false,
      dueDate: "2026-11-05",
      parentType: "project",
      parentId: "p",
    },
    { id: "t2", title: "끝난 일", done: true, dueDate: null, parentType: "goal", parentId: "g" },
    { id: "t3", title: "수집함 일", done: false, dueDate: null, parentType: null, parentId: null },
    {
      id: "t4",
      title: "보관 부모",
      done: false,
      dueDate: null,
      parentType: "area",
      parentId: "old",
    },
    {
      id: "t5",
      title: "부모 없음",
      done: false,
      dueDate: null,
      parentType: "project",
      parentId: "gone",
    },
  ],
};

const ids = (g: { nodes: { id: string }[] }) => g.nodes.map((n) => n.id).sort();

describe("graph task nodes", () => {
  it("are off by default", () => {
    expect(ids(buildGraph(SOURCE))).not.toContain("task:t1");
  });

  it("show open tasks with a belongs edge to the parent; done ones on request", () => {
    const types = ["project", "goal", "area", "task"] as const;
    const g = buildGraph(SOURCE, { types: [...types] });
    expect(ids(g)).toEqual(["goal:g", "project:p", "task:t1", "task:t3"]);
    expect(g.edges).toEqual([{ source: "task:t1", target: "project:p", kind: "belongs" }]);
    expect(g.nodes.find((n) => n.id === "task:t1")).toMatchObject({
      done: false,
      dueDate: "2026-11-05",
      parent: "project:p",
      size: 1,
    });

    const withDone = buildGraph(SOURCE, { types: [...types], doneTasks: true });
    expect(ids(withDone)).toContain("task:t2");
    // Tasks of archived parents come with "보관 보기".
    const archived = buildGraph(SOURCE, { types: [...types], archived: true });
    expect(ids(archived)).toContain("task:t4");
    expect(archived.nodes.find((n) => n.id === "task:t4")?.archived).toBe(true);
  });

  it("stay out of local graphs (tasks are not loaded there)", () => {
    const { tasks: _omit, ...plain } = SOURCE;
    void _omit;
    expect(ids(buildLocalGraph(plain, "project:p", 1))).toEqual(["project:p"]);
  });

  it("parse and keep the 완료 포함 flag only while tasks are shown", () => {
    expect(parseGraphFilter(new URLSearchParams("types=task&doneTasks=1"))).toEqual({
      types: ["task"],
      doneTasks: true,
    });
    expect(normalizeFilter({ doneTasks: true })).toEqual({});
    const f = { types: ["project" as const, "task" as const], doneTasks: true };
    expect(graphQuery(f)).toBe("?types=project%2Ctask&doneTasks=1");
    expect(parsePageQuery(new URLSearchParams("types=project,task&doneTasks=1")).filter).toEqual(f);
    expect(activeFilterCount(f)).toBe(2);
  });

  it("draw small, label last, open the parent, sit beside the parent's PARA column", () => {
    expect(nodeRadius({ type: "task" }, 9)).toBe(3);
    expect(labelPriority("task")).toBeGreaterThan(labelPriority("tag"));
    expect(labelText({ type: "task", title: "끝", archived: false, done: true }, false)).toBe(
      "끝 · 완료",
    );
    expect(nodeHref({ id: "task:t1", title: "", parent: "project:p" })).toBe("/projects/p");
    expect(nodeHref({ id: "task:t2", title: "", parent: "goal:g" })).toBe("/goals/g");
    expect(nodeHref({ id: "task:t3", title: "" })).toBe("/tasks");
    const x = paraXByType(paraColumns(["goal", "area", "project", "task"]));
    expect(paraTargetX({ type: "task", parent: "goal:g" }, x)).toBe(x.goal + TASK_COLUMN_OFFSET);
    expect(paraTargetX({ type: "task" }, x)).toBe(x.project + TASK_COLUMN_OFFSET);
    expect(paraTargetX({ type: "area" }, x)).toBe(x.area);
  });
});
