import { describe, expect, it } from "vitest";
import { constellationPath, edgeKey } from "@/lib/cosmos/path";
import type { GraphEdge, GraphNode, GraphNodeId } from "@/lib/graph/types";

const n = (s: string, horizon?: GraphNode["horizon"]) => ({
  id: s as GraphNodeId,
  type: s.split(":")[0] as GraphNode["type"],
  horizon,
});
const e = (source: string, target: string, kind: GraphEdge["kind"]): GraphEdge => ({
  source: source as GraphNodeId,
  target: target as GraphNodeId,
  kind,
});
const S = (s: string) => s as GraphNodeId;

const nodes = [
  n("goal:life", "life"),
  n("goal:year", "year"),
  n("goal:q", "quarter"),
  n("project:p"),
  n("project:p2"),
  n("area:a"),
  n("paper:x"),
  n("thought:y"),
  n("paper:lonely"),
];
const edges = [
  e("goal:q", "goal:year", "belongs"),
  e("goal:year", "goal:life", "belongs"),
  e("project:p", "goal:q", "belongs"),
  e("project:p2", "goal:year", "belongs"),
  e("project:p", "area:a", "belongs"),
  e("project:p", "paper:x", "link"),
  e("paper:x", "project:p2", "body"),
  e("thought:y", "paper:x", "body"),
];

describe("constellationPath", () => {
  const c = constellationPath(S("paper:x"), nodes, edges);

  it("climbs from a note through every linked project, belongs only after that", () => {
    expect([...c.nodes].sort()).toEqual(
      ["area:a", "goal:life", "goal:q", "goal:year", "paper:x", "project:p", "project:p2"].sort(),
    );
    expect(c.edges.has(edgeKey(e("project:p", "paper:x", "link")))).toBe(true);
    expect(c.edges.has(edgeKey(e("paper:x", "project:p2", "body")))).toBe(true);
    expect(c.edges.has(edgeKey(e("goal:year", "goal:life", "belongs")))).toBe(true);
    expect(c.edges.has(edgeKey(e("thought:y", "paper:x", "body")))).toBe(false);
  });

  it("gives one shortest chain to the life goal and its step count", () => {
    expect(c.chain).toEqual(["paper:x", "project:p2", "goal:year", "goal:life"]);
    expect(c.stepsToLife).toBe(3);
  });

  it("orders path nodes by distance from the start", () => {
    expect(c.order[0]).toBe("paper:x");
    expect(c.order.slice(1, 3).sort()).toEqual(["project:p", "project:p2"]);
    expect(c.order.indexOf("goal:life" as GraphNodeId)).toBe(c.order.length - 1);
    expect(new Set(c.order)).toEqual(c.nodes);
  });

  it("does not hop from note to note or climb down", () => {
    expect([...constellationPath(S("thought:y"), nodes, edges).nodes]).toEqual(["thought:y"]);
    const life = constellationPath(S("goal:life"), nodes, edges);
    expect([...life.nodes]).toEqual(["goal:life"]);
    expect(life.stepsToLife).toBeNull();
  });

  it("uses belongs parents first when the node has them", () => {
    const p = constellationPath(S("project:p"), nodes, edges);
    expect(p.nodes.has(S("paper:x"))).toBe(false);
    expect(p.chain).toEqual(["project:p", "goal:q", "goal:year", "goal:life"]);
  });

  it("stops where the climb ends when no life goal is reached", () => {
    const cut = edges.filter((x) => !(x.source === "goal:year" && x.target === "goal:life"));
    const p = constellationPath(S("project:p"), nodes, cut);
    expect(p.chain).toEqual(["project:p", "goal:q", "goal:year"]);
    expect(p.stepsToLife).toBeNull();
  });

  it("returns the start alone for an unknown or unconnected node", () => {
    expect([...constellationPath(S("paper:nope"), nodes, edges).nodes]).toEqual(["paper:nope"]);
    expect(constellationPath(S("paper:lonely"), nodes, edges).chain).toEqual(["paper:lonely"]);
  });
});
