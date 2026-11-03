import { describe, expect, it } from "vitest";
import { assignGalaxies } from "@/lib/cosmos/galaxy";
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

describe("assignGalaxies", () => {
  const nodes = [
    n("area:a"),
    n("area:b"),
    n("project:p", { areaId: "a" }),
    n("project:q", { areaId: "b" }),
    n("goal:life", { horizon: "life", areaId: "a" }),
    n("goal:y", { horizon: "year", areaId: "b" }),
    n("paper:x"),
    n("paper:tie"),
    n("thought:alone"),
    n("project:ghost", { areaId: "deleted" }),
  ];
  const edges = [
    e("project:p", "area:a"),
    e("paper:x", "project:p"),
    e("paper:x", "goal:y"),
    e("project:q", "paper:x"),
    e("paper:tie", "project:p"),
    e("paper:tie", "project:q"),
  ];
  const g = assignGalaxies(nodes, edges);

  it("uses the area itself and areaId directly", () => {
    expect(g.get("area:a" as GraphNodeId)).toBe("a");
    expect(g.get("project:q" as GraphNodeId)).toBe("b");
    expect(g.get("goal:y" as GraphNodeId)).toBe("b");
  });

  it("lets other nodes follow the majority of their neighbours (ties: smaller id)", () => {
    expect(g.get("paper:x" as GraphNodeId)).toBe("b"); // a: 1 (p), b: 2 (y, q)
    expect(g.get("paper:tie" as GraphNodeId)).toBe("a");
  });

  it("keeps life goals, unconnected items and unknown areas neutral", () => {
    expect(g.get("goal:life" as GraphNodeId)).toBeNull();
    expect(g.get("thought:alone" as GraphNodeId)).toBeNull();
    expect(g.get("project:ghost" as GraphNodeId)).toBeNull();
  });
});
