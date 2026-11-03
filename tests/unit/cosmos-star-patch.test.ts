import { describe, expect, it } from "vitest";
import { withStar } from "@/lib/cosmos/star-patch";
import type { CosmosNodeInfo, CosmosResponse } from "@/lib/cosmos/types";
import type { GraphNodeId } from "@/lib/graph/types";

const NOW = new Date("2026-11-03T12:00:00.000Z");
const id = (s: string) => s as GraphNodeId;
const info = (extra: Partial<CosmosNodeInfo> = {}): CosmosNodeInfo => ({
  score: 0,
  direct: 0.3,
  centrality: 0,
  recency: 0.5,
  starred: false,
  sun: false,
  galaxy: null,
  lastActiveAt: NOW.toISOString(),
  ...extra,
});

function data(): CosmosResponse {
  return {
    nodes: [
      { id: id("thought:a"), type: "thought", title: "A", size: 0, archived: false },
      { id: id("paper:b"), type: "paper", title: "B", size: 1, archived: false },
      { id: id("project:c"), type: "project", title: "C", size: 1, archived: true },
    ],
    edges: [{ source: id("paper:b"), target: id("project:c"), kind: "link" }],
    positions: [],
    cosmos: {
      [id("thought:a")]: info({ score: 0.22 }),
      [id("paper:b")]: info({ direct: 0.9, centrality: 1, recency: 1, score: 0.81 }),
      [id("project:c")]: info({ direct: 0.6, score: 0.17 }),
    },
    galaxies: [],
    top: [id("paper:b"), id("thought:a"), id("project:c")],
    lonely: [id("thought:a")],
    neglected: [],
  };
}

describe("withStar", () => {
  it("re-scores the node, re-sorts the panel and keeps nodes/edges identical", () => {
    const before = data();
    const after = withStar(before, id("thought:a"), true, NOW)!;
    expect(after.cosmos[id("thought:a")]).toMatchObject({ starred: true, score: 0.7 });
    expect(after.top[0]).toBe("paper:b");
    expect(after.top[1]).toBe("thought:a");
    expect(after.nodes).toBe(before.nodes);
    expect(after.edges).toBe(before.edges);
    expect(after.lonely).toEqual(["thought:a"]);
    // The input is not mutated.
    expect(before.cosmos[id("thought:a")]!.starred).toBe(false);
  });

  it("halves an archived node's starred score and can unstar", () => {
    const starred = withStar(data(), id("project:c"), true, NOW)!;
    expect(starred.cosmos[id("project:c")]!.score).toBeCloseTo(0.35);
    const back = withStar(starred, id("project:c"), false, NOW)!;
    expect(back.cosmos[id("project:c")]!.score).toBeCloseTo(
      (0.4 * 0.6 + 0.25 * 0 + 0.2 * 0.5) * 0.5,
    );
  });

  it("returns null for a node that is not shown", () => {
    expect(withStar(data(), id("paper:zzz"), true, NOW)).toBeNull();
  });
});
