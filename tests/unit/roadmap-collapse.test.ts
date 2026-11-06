import { describe, expect, it } from "vitest";
import {
  collapseAll,
  expandAll,
  isAllCollapsed,
  isAllExpanded,
  toggleCollapsed,
  visibleTree,
} from "@/app/roadmap/collapse";
import { defaultCollapsed } from "@/app/roadmap/roadmapLayout";
import { includeDoneHref } from "@/app/roadmap/RoadmapToolbar";
import type { RoadmapKind, RoadmapNode } from "@/lib/repo/roadmap-types";

function n(kind: RoadmapKind, id: string, children: RoadmapNode[] = []): RoadmapNode {
  return {
    kind,
    id,
    title: `${kind} ${id}`,
    href: null,
    status: null,
    progress: null,
    due: null,
    children,
  };
}

const roots: RoadmapNode[] = [
  n("area", "a1", [
    n("goal", "g1", [n("project", "p1", [n("task", "t1"), n("task", "t2")]), n("project", "p2")]),
  ]),
  n("area", "a2"),
];

/** `kind-id` of every node in a tree, depth first. */
const ids = (nodes: RoadmapNode[]): string[] =>
  nodes.flatMap((x) => [`${x.kind}-${x.id}`, ...ids(x.children)]);

describe("roadmap collapse", () => {
  it("toggle flips one key and leaves the input alone", () => {
    const start = new Set(["project-p1"]);
    const opened = toggleCollapsed(start, "project-p1");
    expect([...opened]).toEqual([]);
    expect([...toggleCollapsed(opened, "goal-g1")]).toEqual(["goal-g1"]);
    expect([...start]).toEqual(["project-p1"]);
  });

  it("collapseAll covers every node with children; expandAll is empty", () => {
    expect([...collapseAll(roots)].sort()).toEqual(["area-a1", "goal-g1", "project-p1"]);
    expect(expandAll().size).toBe(0);
  });

  it("reports all-expanded / all-collapsed", () => {
    expect(isAllExpanded(roots, expandAll())).toBe(true);
    expect(isAllCollapsed(roots, expandAll())).toBe(false);
    expect(isAllCollapsed(roots, collapseAll(roots))).toBe(true);
    expect(isAllExpanded(roots, defaultCollapsed(roots))).toBe(false);
    expect(isAllCollapsed(roots, defaultCollapsed(roots))).toBe(false);
  });

  it("visibleTree hides tasks under the default and keeps the source intact", () => {
    const vis = visibleTree(roots, defaultCollapsed(roots));
    expect(ids(vis)).toEqual(["area-a1", "goal-g1", "project-p1", "project-p2", "area-a2"]);
    expect(roots[0].children[0].children[0].children).toHaveLength(2);
    // Untouched subtrees keep their identity.
    expect(vis[1]).toBe(roots[1]);
    expect(vis[0].children[0].children[1]).toBe(roots[0].children[0].children[1]);
  });

  it("visibleTree shows everything when expanded and only roots when all collapsed", () => {
    expect(visibleTree(roots, expandAll())).toEqual(roots);
    expect(ids(visibleTree(roots, collapseAll(roots)))).toEqual(["area-a1", "area-a2"]);
  });
});

describe("roadmap toolbar 완료 포함 link", () => {
  it("adds ?all=1 when off and drops it when on, keeping other params", () => {
    expect(includeDoneHref("/roadmap", null, false)).toBe("/roadmap?all=1");
    expect(includeDoneHref("/roadmap", new URLSearchParams("all=1"), true)).toBe("/roadmap");
    expect(includeDoneHref("/roadmap", new URLSearchParams("all=1&x=2"), true)).toBe(
      "/roadmap?x=2",
    );
  });
});
