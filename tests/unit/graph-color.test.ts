import { describe, expect, it } from "vitest";
import { assignAreaSlots, isGraphColorBy, slotColor } from "@/lib/graph/color";
import { GRAPH_NODE_TYPE_ORDER, type GraphNode, type GraphNodeId } from "@/lib/graph/types";
import { nodeColor, quarterGoalFill } from "@/components/graph/draw";
import { GRAPH_THEME_DARK, GRAPH_THEME_LIGHT } from "@/components/graph/graph-theme";

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
    n("goal:life", { horizon: "life" }),
  ];
  const edges = [
    e("paper:x", "project:p"),
    e("paper:tie", "project:p"),
    e("paper:tie", "project:q"),
    e("review:r", "project:p"),
    e("goal:life", "project:p"),
  ];

  it("numbers used areas in sidebar order, skipping unused ones", () => {
    const { slot, areas } = assignAreaSlots(nodes, edges, ["unused", "b", "a"]);
    expect(areas).toEqual(["b", "a"]);
    expect(slot.get("area:b" as GraphNodeId)).toBe(0);
    expect(slot.get("project:q" as GraphNodeId)).toBe(0);
    expect(slot.get("project:p" as GraphNodeId)).toBe(1);
  });

  it("follows the neighbour majority; ties, loners, reviews and area-less life goals are neutral", () => {
    const { slot } = assignAreaSlots(nodes, edges, ["b", "a"]);
    expect(slot.get("paper:x" as GraphNodeId)).toBe(1);
    expect(slot.get("paper:tie" as GraphNodeId)).toBeNull();
    expect(slot.get("thought:alone" as GraphNodeId)).toBeNull();
    expect(slot.get("review:r" as GraphNodeId)).toBeNull();
    expect(slot.get("goal:life" as GraphNodeId)).toBeNull();
  });

  it("gives a life goal with an area that area's color, and lets it vote", () => {
    const { slot } = assignAreaSlots(
      [n("goal:life", { horizon: "life", areaId: "a" }), n("thought:t")],
      [e("thought:t", "goal:life")],
      ["a"],
    );
    expect(slot.get("goal:life" as GraphNodeId)).toBe(0);
    expect(slot.get("thought:t" as GraphNodeId)).toBe(0);
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
    expect(isGraphColorBy("kind")).toBe(true);
    expect(isGraphColorBy("area")).toBe(true);
    expect(isGraphColorBy("galaxy")).toBe(false);
    expect(isGraphColorBy(null)).toBe(false);
  });
});

describe("nodeColor / quarterGoalFill (design 1.2–1.3)", () => {
  it("uses the kind color by kind, in each theme", () => {
    expect(nodeColor("paper", "kind", 3, GRAPH_THEME_LIGHT)).toBe("#348dcf");
    expect(nodeColor("paper", "kind", 3, GRAPH_THEME_DARK)).toBe("#75bffc");
    expect(nodeColor("goal", "kind", null, GRAPH_THEME_LIGHT)).toBe("#cc3430");
  });

  it("uses the area slot (goals too) or neutral by area", () => {
    expect(nodeColor("goal", "area", 0, GRAPH_THEME_LIGHT)).toBe("#1587ba");
    expect(nodeColor("paper", "area", 13, GRAPH_THEME_DARK)).toBe("#ed914c");
    expect(nodeColor("paper", "area", null, GRAPH_THEME_LIGHT)).toBe("#71747c");
    expect(nodeColor("review", "area", undefined, GRAPH_THEME_DARK)).toBe("#b4b7bf");
  });

  it("fills quarter goals with goalSoft by kind and the background by area", () => {
    expect(quarterGoalFill("kind", GRAPH_THEME_LIGHT)).toBe("#fbecea");
    expect(quarterGoalFill("area", GRAPH_THEME_DARK)).toBe("#141416");
  });

  it("has a color for every kind and 12 area colors in both themes", () => {
    for (const theme of [GRAPH_THEME_LIGHT, GRAPH_THEME_DARK]) {
      for (const t of GRAPH_NODE_TYPE_ORDER) expect(theme.kind[t]).toMatch(/^#[0-9a-f]{6}$/);
      expect(theme.area).toHaveLength(12);
    }
  });
});
