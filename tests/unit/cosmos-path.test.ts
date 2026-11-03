import { describe, expect, it } from "vitest";
import { constellationPath } from "@/lib/cosmos/path";
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

const nodes = [
  n("goal:life", "life"),
  n("goal:year", "year"),
  n("goal:q", "quarter"),
  n("project:p"),
  n("area:a"),
  n("paper:x"),
  n("thought:y"),
  n("paper:lonely"),
];
const edges = [
  e("goal:q", "goal:year", "belongs"),
  e("goal:year", "goal:life", "belongs"),
  e("project:p", "goal:q", "belongs"),
  e("project:p", "area:a", "belongs"),
  e("project:p", "paper:x", "link"), // project → paper: the note still climbs
  e("thought:y", "paper:x", "body"), // note ↔ note: not a step
];

describe("constellationPath", () => {
  it("climbs item → project → quarter → year → life goal", () => {
    expect(constellationPath("paper:x" as GraphNodeId, nodes, edges)).toEqual([
      "paper:x",
      "project:p",
      "goal:q",
      "goal:year",
      "goal:life",
    ]);
  });

  it("does not wander through other notes or down the tree", () => {
    expect(constellationPath("thought:y" as GraphNodeId, nodes, edges)).toEqual(["thought:y"]);
    expect(constellationPath("goal:life" as GraphNodeId, nodes, edges)).toEqual(["goal:life"]);
    expect(constellationPath("paper:lonely" as GraphNodeId, nodes, edges)).toEqual([
      "paper:lonely",
    ]);
  });

  it("stops at the highest goal when no life goal is reachable", () => {
    const cut = edges.filter((x) => !(x.source === "goal:year" && x.target === "goal:life"));
    expect(constellationPath("project:p" as GraphNodeId, nodes, cut)).toEqual([
      "project:p",
      "goal:q",
      "goal:year",
    ]);
  });

  it("takes the shortest way when a project points straight at a year goal", () => {
    const direct = [...edges, e("project:p", "goal:year", "belongs")];
    expect(constellationPath("project:p" as GraphNodeId, nodes, direct)).toEqual([
      "project:p",
      "goal:year",
      "goal:life",
    ]);
  });

  it("returns the start alone for an unknown node", () => {
    expect(constellationPath("paper:nope" as GraphNodeId, nodes, edges)).toEqual(["paper:nope"]);
  });
});
