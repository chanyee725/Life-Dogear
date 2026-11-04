import { describe, expect, it } from "vitest";
import { assignAreaSlots, isGraphColorBy, slotColor } from "@/lib/graph/color";
import type { GraphNode, GraphNodeId } from "@/lib/graph/types";

const n = (id: string, extra: Partial<GraphNode> = {}) => ({
  id: id as GraphNodeId,
  type: id.split(":")[0] as GraphNode["type"],
  ...extra,
});
const e = (source: string, target: string) => ({
  source: source as GraphNodeId,
  target: target as GraphNodeId,
});

describe("assignAreaSlots", () => {
  const nodes = [
    n("area:b"),
    n("project:p", { areaId: "a" }),
    n("project:q", { areaId: "b" }),
    n("paper:x"),
    n("paper:tie"),
    n("thought:alone"),
    n("review:r"),
    n("goal:life", { horizon: "life", areaId: "a" }),
  ];
  const edges = [
    e("paper:x", "project:p"),
    e("paper:tie", "project:p"),
    e("paper:tie", "project:q"),
    e("review:r", "project:p"),
  ];

  it("numbers used areas in sidebar order, skipping unused ones", () => {
    const { slot, areas } = assignAreaSlots(nodes, edges, ["unused", "b", "a"]);
    expect(areas).toEqual(["b", "a"]);
    expect(slot.get("area:b" as GraphNodeId)).toBe(0);
    expect(slot.get("project:q" as GraphNodeId)).toBe(0);
    expect(slot.get("project:p" as GraphNodeId)).toBe(1);
  });

  it("follows the neighbour majority; ties, loners, reviews and life goals are neutral", () => {
    const { slot } = assignAreaSlots(nodes, edges, ["b", "a"]);
    expect(slot.get("paper:x" as GraphNodeId)).toBe(1);
    expect(slot.get("paper:tie" as GraphNodeId)).toBeNull();
    expect(slot.get("thought:alone" as GraphNodeId)).toBeNull();
    expect(slot.get("review:r" as GraphNodeId)).toBeNull();
    expect(slot.get("goal:life" as GraphNodeId)).toBeNull();
  });

  it("counts an area id even when the area node is filtered out", () => {
    const { slot } = assignAreaSlots([n("project:p", { areaId: "a" })], [], ["a"]);
    expect(slot.get("project:p" as GraphNodeId)).toBe(0);
  });

  it("ignores area ids that no longer exist", () => {
    const { slot, areas } = assignAreaSlots([n("project:p", { areaId: "gone" })], [], ["a"]);
    expect(slot.get("project:p" as GraphNodeId)).toBeNull();
    expect(areas).toEqual([]);
  });

  it("appends areas missing from the order (mocks) in node order", () => {
    const { areas } = assignAreaSlots([n("area:z"), n("area:y")], []);
    expect(areas).toEqual(["z", "y"]);
  });
});

describe("slotColor", () => {
  const palette = ["#111111", "#222222", "#333333"];
  it("wraps around the palette", () => {
    expect(slotColor(0, palette, "#999999")).toBe("#111111");
    expect(slotColor(4, palette, "#999999")).toBe("#222222");
  });
  it("is neutral without a slot", () => {
    expect(slotColor(null, palette, "#999999")).toBe("#999999");
    expect(slotColor(undefined, palette, "#999999")).toBe("#999999");
  });
});

describe("isGraphColorBy", () => {
  it("accepts only the two bases", () => {
    expect(isGraphColorBy("type")).toBe(true);
    expect(isGraphColorBy("area")).toBe(true);
    expect(isGraphColorBy("galaxy")).toBe(false);
    expect(isGraphColorBy(null)).toBe(false);
  });
});
