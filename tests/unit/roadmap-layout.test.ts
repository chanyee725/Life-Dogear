import { describe, expect, it } from "vitest";
import {
  defaultCollapsed,
  edgePath,
  layoutTree,
  type LayoutSize,
  type PlacedNode,
} from "@/app/roadmap/roadmapLayout";
import type { RoadmapKind, RoadmapNode } from "@/lib/repo/roadmap-types";

const SIZE: LayoutSize = { nodeWidth: 100, nodeHeight: 20, colGap: 40, rowGap: 10 };

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

/** Two areas: one with goals → projects → tasks (uneven depths), one bare. */
const roots: RoadmapNode[] = [
  n("area", "a1", [
    n("goal", "g1", [
      n("project", "p1", [n("task", "t1"), n("task", "t2"), n("task", "t3")]),
      n("project", "p2"),
    ]),
    n("goal", "g2", [n("project", "p3", [n("task", "t4")])]),
  ]),
  n("area", "a2"),
  n("area", "none", [n("project", "p4", [n("task", "t5"), n("task", "t6")])]),
];

const byId = (nodes: PlacedNode[], id: string) => nodes.find((p) => p.id === id)!;
const centre = (p: PlacedNode) => p.y + SIZE.nodeHeight / 2;

function expectNoOverlap(nodes: PlacedNode[]) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const xOverlap = a.x < b.x + SIZE.nodeWidth && b.x < a.x + SIZE.nodeWidth;
      const yOverlap = a.y < b.y + SIZE.nodeHeight && b.y < a.y + SIZE.nodeHeight;
      expect(xOverlap && yOverlap, `${a.key} overlaps ${b.key}`).toBe(false);
    }
  }
}

function expectParentsCentred(nodes: PlacedNode[]) {
  for (const parent of nodes) {
    const kids = nodes.filter((c) => c.parentKey === parent.key);
    if (!kids.length) continue;
    const ys = kids.map(centre);
    expect(centre(parent)).toBeCloseTo((Math.min(...ys) + Math.max(...ys)) / 2);
  }
}

describe("layoutTree", () => {
  it("puts each depth in its own column", () => {
    const { nodes } = layoutTree(roots, new Set(), SIZE);
    for (const p of nodes) expect(p.x).toBe(p.depth * 140);
    expect(byId(nodes, "area-a1").depth).toBe(0);
    expect(byId(nodes, "task-t1").depth).toBe(3);
  });

  it("never overlaps boxes and centres parents on their children (all open)", () => {
    const { nodes, width, height } = layoutTree(roots, new Set(), SIZE);
    expect(nodes).toHaveLength(15);
    expectNoOverlap(nodes);
    expectParentsCentred(nodes);
    // Siblings keep their order top to bottom.
    expect(byId(nodes, "task-t1").y).toBeLessThan(byId(nodes, "task-t2").y);
    expect(byId(nodes, "goal-g1").y).toBeLessThan(byId(nodes, "goal-g2").y);
    // Several roots stack (virtual root), and the box fits everything.
    expect(byId(nodes, "area-a1").y).toBeLessThan(byId(nodes, "area-a2").y);
    expect(width).toBe(4 * 100 + 3 * 40);
    for (const p of nodes) expect(p.y + SIZE.nodeHeight).toBeLessThanOrEqual(height);
  });

  it("drops the children of a collapsed node and still centres the rest", () => {
    const open = layoutTree(roots, new Set(), SIZE);
    const folded = layoutTree(roots, new Set(["project-p1", "goal-g2"]), SIZE);
    const ids = folded.nodes.map((p) => p.id);
    expect(ids).not.toContain("task-t1");
    expect(ids).not.toContain("project-p3");
    expect(ids).not.toContain("task-t4");
    expect(ids).toContain("project-p1");
    expect(byId(folded.nodes, "project-p1").collapsed).toBe(true);
    expect(byId(folded.nodes, "goal-g1").collapsed).toBe(false);
    expect(folded.height).toBeLessThan(open.height);
    expectNoOverlap(folded.nodes);
    expectParentsCentred(folded.nodes);
    // No edge points at a hidden node.
    const keys = new Set(folded.nodes.map((p) => p.key));
    for (const e of folded.edges) expect(keys.has(e.key)).toBe(true);
  });

  it("ignores collapse on a leaf", () => {
    const { nodes } = layoutTree(roots, new Set(["area-a2"]), SIZE);
    expect(byId(nodes, "area-a2").collapsed).toBe(false);
  });

  it("joins every child to its parent's right edge", () => {
    const { nodes, edges } = layoutTree(roots, new Set(), SIZE);
    expect(edges).toHaveLength(nodes.length - 3);
    const t1 = byId(nodes, "task-t1");
    const p1 = byId(nodes, "project-p1");
    const e = edges.find((x) => x.key === t1.key)!;
    expect(e).toMatchObject({ x1: p1.x + 100, y1: centre(p1), x2: t1.x, y2: centre(t1) });
    expect(edgePath(e)).toMatch(/^M[\d.]+,[\d.]+ C/);
  });

  it("keeps per-kind boxes apart when a parent is taller than its children", () => {
    const sized: LayoutSize = {
      ...SIZE,
      branchGap: 16,
      kinds: { area: { width: 120, height: 60 }, task: { width: 80, height: 12 } },
    };
    const { nodes, edges, height } = layoutTree(roots, new Set(), sized);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const hit =
          a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(hit, `${a.key} overlaps ${b.key}`).toBe(false);
      }
    }
    for (const p of nodes) expect(p.y).toBeGreaterThanOrEqual(0);
    for (const p of nodes) expect(p.y + p.height).toBeLessThanOrEqual(height);
    // Column 1 starts after the widest box of column 0 (the 120px area).
    expect(byId(nodes, "goal-g1").x).toBe(120 + 40);
    const e = edges.find((x) => x.key.endsWith("task-t1"))!;
    expect(e.x2 - e.x1).toBe(40);
  });

  it("is empty for no roots", () => {
    expect(layoutTree([], new Set(), SIZE)).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });
});

describe("defaultCollapsed", () => {
  it("folds only nodes that hold tasks", () => {
    expect([...defaultCollapsed(roots)].sort()).toEqual(["project-p1", "project-p3", "project-p4"]);
  });
});
