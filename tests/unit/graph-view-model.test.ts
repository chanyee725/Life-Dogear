import { describe, expect, it } from "vitest";
import { withAlpha } from "@/components/graph/draw";
import {
  activeFilterCount,
  cycleNeighbor,
  distancesFrom,
  drawableEdges,
  goalLabel,
  graphQuery,
  initialFocus,
  isDefaultFilter,
  labelText,
  labelZoom,
  nodeHref,
  nodeInDirection,
  nodeRadius,
  pageQuery,
  paraColumns,
  paraXByType,
  parsePageQuery,
  searchNodes,
} from "@/components/graph/model";
import type { GraphEdge, GraphNode, GraphNodeId } from "@/lib/graph/types";

const n = (id: string, extra: Partial<GraphNode> = {}): GraphNode => ({
  id: id as GraphNodeId,
  type: id.split(":")[0] as GraphNode["type"],
  title: id,
  size: 0,
  archived: false,
  ...extra,
});
const e = (source: string, target: string, kind: GraphEdge["kind"] = "link"): GraphEdge => ({
  source: source as GraphNodeId,
  target: target as GraphNodeId,
  kind,
});

describe("nodeRadius", () => {
  it("grows with √degree from the kind's base and caps at 16", () => {
    expect(nodeRadius({ type: "paper" }, 0)).toBe(4);
    expect(nodeRadius({ type: "paper" }, 4)).toBeCloseTo(4 + 2.4);
    expect(nodeRadius({ type: "goal", horizon: "life" }, 0)).toBe(9);
    expect(nodeRadius({ type: "goal", horizon: "year" }, 0)).toBe(7);
    expect(nodeRadius({ type: "goal", horizon: "quarter" }, 0)).toBe(6);
    expect(nodeRadius({ type: "area" }, 10000)).toBe(16);
  });

  it("keeps reviews and topics at 3.5 and shrinks the base on large graphs (min 3)", () => {
    expect(nodeRadius({ type: "review" }, 50)).toBe(3.5);
    expect(nodeRadius({ type: "tag" }, 50)).toBe(3.5);
    expect(nodeRadius({ type: "project" }, 0, true)).toBe(4);
    expect(nodeRadius({ type: "thought" }, 0, true)).toBe(3);
  });
});

describe("paraColumns", () => {
  it("orders goal → area → project → source → thought, 280 apart", () => {
    const cols = paraColumns(["goal", "area", "project", "paper", "seminar", "thought"]);
    expect(cols.map((c) => c.label)).toEqual(["목표", "영역", "프로젝트", "자료", "생각"]);
    expect(cols.map((c) => c.x)).toEqual([0, 280, 560, 840, 1120]);
    const x = paraXByType(cols);
    expect(x.paper).toBe(x.seminar);
  });

  it("drops hidden kinds and adds review / topic columns on the right when shown", () => {
    const cols = paraColumns(["goal", "project", "thought", "review", "tag"]);
    expect(cols.map((c) => [c.label, c.x])).toEqual([
      ["목표", 0],
      ["프로젝트", 280],
      ["생각", 560],
      ["회고", 840],
      ["주제", 1120],
    ]);
  });
});

describe("labels", () => {
  it("shows goals/areas first, then projects, then the rest; later on dense graphs", () => {
    expect(labelZoom({ type: "goal", horizon: "life" }, 10)).toBe(0.8);
    expect(labelZoom({ type: "goal", horizon: "quarter" }, 10)).toBe(1.3);
    expect(labelZoom({ type: "project" }, 10)).toBe(1.3);
    expect(labelZoom({ type: "paper" }, 10)).toBe(2);
    expect(labelZoom({ type: "area" }, 301)).toBe(1.3);
    expect(labelZoom({ type: "thought" }, 301)).toBe(2.5);
  });

  it("truncates at 18 (40 when emphasised), prefixes topics and marks archived", () => {
    const long = "가".repeat(30);
    expect(labelText({ type: "paper", title: long, archived: false }, false)).toBe(
      `${"가".repeat(17)}…`,
    );
    expect(labelText({ type: "paper", title: long, archived: false }, true)).toBe(long);
    expect(labelText({ type: "tag", title: "통계", archived: false }, false)).toBe("#통계");
    expect(labelText({ type: "thought", title: "메모", archived: true }, false)).toBe(
      "메모 · 보관",
    );
  });

  it("names goals by horizon and period", () => {
    expect(goalLabel({ horizon: "life" })).toBe("인생 목표");
    expect(goalLabel({ horizon: "year", period: "2027" })).toBe("연 목표 2027");
    expect(goalLabel({ horizon: "quarter", period: "2027-Q1" })).toBe("분기 목표 2027-Q1");
  });
});

describe("edges", () => {
  it("collapses link + body between the same pair and drops dangling edges and loops", () => {
    const nodes = [n("paper:a"), n("thought:b"), n("project:c")];
    const edges = drawableEdges(nodes, [
      e("paper:a", "thought:b", "link"),
      e("thought:b", "paper:a", "body"),
      e("paper:a", "project:c", "belongs"),
      e("paper:a", "project:c", "link"),
      e("paper:a", "paper:a"),
      e("paper:a", "area:gone"),
    ]);
    expect(edges.map((x) => `${x.kind}:${x.source}-${x.target}`)).toEqual([
      "link:paper:a-thought:b",
      "belongs:paper:a-project:c",
      "link:paper:a-project:c",
    ]);
  });

  it("measures step distance for the local graph", () => {
    const d = distancesFrom(
      [e("paper:a", "thought:b"), e("thought:b", "project:c"), e("project:c", "area:d")],
      "paper:a" as GraphNodeId,
      2,
    );
    expect(Object.fromEntries(d)).toEqual({ "paper:a": 0, "thought:b": 1, "project:c": 2 });
  });
});

describe("keyboard navigation", () => {
  const pos = [
    { id: "paper:o" as GraphNodeId, x: 0, y: 0 },
    { id: "paper:r" as GraphNodeId, x: 100, y: 10 },
    { id: "paper:far" as GraphNodeId, x: 300, y: 0 },
    { id: "paper:d" as GraphNodeId, x: 5, y: 50 },
  ];

  it("picks the nearest node within ±45° of the direction", () => {
    expect(nodeInDirection(pos[0]!, "right", pos, undefined)).toBe("paper:r");
    expect(nodeInDirection(pos[0]!, "down", pos, undefined)).toBe("paper:d");
    expect(nodeInDirection(pos[0]!, "left", pos, undefined)).toBeNull();
  });

  it("prefers connected neighbours over closer strangers", () => {
    const nb = new Set<GraphNodeId>(["paper:far" as GraphNodeId]);
    expect(nodeInDirection(pos[0]!, "right", pos, nb)).toBe("paper:far");
  });

  it("cycles neighbours by title with [ and ]", () => {
    const nb = new Set(["paper:b", "paper:a", "paper:c"] as GraphNodeId[]);
    const title = (id: GraphNodeId) => id;
    const c = "goal:x" as GraphNodeId;
    expect(cycleNeighbor(c, null, 1, nb, title)).toBe("paper:a");
    expect(cycleNeighbor(c, "paper:c" as GraphNodeId, 1, nb, title)).toBe("paper:a");
    expect(cycleNeighbor(c, "paper:a" as GraphNodeId, -1, nb, title)).toBe("paper:c");
    expect(cycleNeighbor(c, null, 1, new Set(), title)).toBeNull();
  });

  it("starts at the selection, else the biggest life goal, else the most connected node", () => {
    const nodes = [
      n("paper:a", { size: 9 }),
      n("goal:l", { horizon: "life", size: 1 }),
      n("goal:y", { horizon: "year", size: 5 }),
    ];
    expect(initialFocus(nodes, "paper:a" as GraphNodeId)).toBe("paper:a");
    expect(initialFocus(nodes, null)).toBe("goal:l");
    expect(initialFocus(nodes.slice(0, 1).concat(nodes[2]!), null)).toBe("paper:a");
    expect(initialFocus([], null)).toBeNull();
  });
});

describe("search", () => {
  it("ranks prefix matches first, then by connections; ignores case and spacing", () => {
    const nodes = [
      n("paper:1", { title: "질적 연구 방법", size: 1 }),
      n("paper:2", { title: "연구 설계", size: 2 }),
      n("paper:3", { title: "연구  노트", size: 5 }),
    ];
    expect(searchNodes(nodes, "연구").map((x) => x.id)).toEqual(["paper:3", "paper:2", "paper:1"]);
    expect(searchNodes(nodes, "  연구 노트 ").map((x) => x.id)).toEqual(["paper:3"]);
    expect(searchNodes(nodes, "")).toEqual([]);
  });
});

describe("filter and URL state", () => {
  it("treats the default kinds as no filter and counts active conditions", () => {
    expect(
      isDefaultFilter({ types: ["goal", "area", "project", "paper", "seminar", "thought"] }),
    ).toBe(true);
    expect(isDefaultFilter({ types: ["goal"] })).toBe(false);
    expect(activeFilterCount({ types: ["goal"], archived: true, tag: "통계" })).toBe(3);
    expect(graphQuery({})).toBe("");
    expect(graphQuery({ types: ["review", "goal"], orphans: true })).toBe(
      "?types=goal%2Creview&orphans=1",
    );
  });

  it("round-trips filter, view and focus through the page URL", () => {
    const state = {
      filter: { types: ["goal" as const, "tag" as const], area: "a1", tag: "통계", archived: true },
      view: "para" as const,
      focus: "paper:p1" as GraphNodeId,
    };
    const parsed = parsePageQuery(new URLSearchParams(pageQuery(state)));
    expect(parsed).toEqual(state);
  });

  it("falls back to defaults for unknown values", () => {
    const parsed = parsePageQuery(
      new URLSearchParams("view=3d&focus=bogus:1&types=goal,nope&archived=yes"),
    );
    expect(parsed).toEqual({ filter: { types: ["goal"] }, view: "free", focus: null });
  });
});

describe("nodeHref", () => {
  it("routes items to their detail pages and topics to the tag page by name", () => {
    expect(nodeHref({ id: "paper:p1" as GraphNodeId, title: "x" })).toBe("/papers/p1");
    expect(nodeHref({ id: "goal:g1" as GraphNodeId, title: "x" })).toBe("/goals/g1");
    expect(nodeHref({ id: "review:r1" as GraphNodeId, title: "x" })).toBe("/reviews/r1");
    expect(nodeHref({ id: "tag:t1" as GraphNodeId, title: "질적 연구" })).toBe(
      "/tags/%EC%A7%88%EC%A0%81%20%EC%97%B0%EA%B5%AC",
    );
    expect(nodeHref({ id: "nope" as GraphNodeId, title: "x" })).toBeNull();
  });
});

describe("withAlpha", () => {
  it("converts hex colors to rgba", () => {
    expect(withAlpha("#18181b", 0.5)).toBe("rgba(24, 24, 27, 0.5)");
    expect(withAlpha("#fff", 0.2)).toBe("rgba(255, 255, 255, 0.2)");
    expect(withAlpha("red", 0.2)).toBe("red");
  });
});
