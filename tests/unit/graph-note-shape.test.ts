import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GRAPH_NODE_TYPE_ORDER } from "@/lib/graph/types";
import { nodeColor, shapeBottom, shapeExtents, traceShape } from "@/components/graph/draw";
import { GRAPH_THEME_DARK, GRAPH_THEME_LIGHT } from "@/components/graph/graph-theme";
import { GRAPH_TYPE_LABEL, nodeRadius, paraColumns, paraXByType } from "@/components/graph/model";
import { ShapeIcon } from "@/components/graph/ShapeIcon";

/** Records the path a shape traces. */
function tracePoints(type: Parameters<typeof traceShape>[1], r: number) {
  const points: [number, number][] = [];
  const ctx = {
    beginPath() {},
    closePath() {},
    moveTo: (x: number, y: number) => points.push([x, y]),
    lineTo: (x: number, y: number) => points.push([x, y]),
    arc() {
      throw new Error("not a triangle");
    },
  } as unknown as CanvasRenderingContext2D;
  traceShape(ctx, type, 0, 0, r);
  return points;
}

describe("note node (graph.md 1.2 / 2.1)", () => {
  it("is a downward triangle: the seminar ▲ turned 180°", () => {
    const up = tracePoints("seminar", 4);
    const down = tracePoints("note", 4);
    expect(down).toHaveLength(3);
    // Apex below the centre (canvas y grows downward), circumradius 1.3r.
    expect(down[0]).toEqual([0, 1.3 * 4]);
    expect(down.map(([x, y]) => [x, -y])).toEqual(up.map(([x, y]) => [x, y]));
  });

  it("places labels below the apex and keeps the seminar's extents mirrored", () => {
    const r = 5;
    expect(shapeBottom("note", r)).toBeCloseTo(1.3 * r);
    const note = shapeExtents("note", r);
    const seminar = shapeExtents("seminar", r);
    expect(note.top).toBeCloseTo(seminar.bottom);
    expect(note.bottom).toBeCloseTo(seminar.top);
    expect(note.side).toBeCloseTo(seminar.side);
  });

  it("uses the design's ink-brown in both themes and base radius 4", () => {
    expect(nodeColor("note", "kind", null, GRAPH_THEME_LIGHT)).toBe("#773a10");
    expect(nodeColor("note", "kind", null, GRAPH_THEME_DARK)).toBe("#b9632c");
    expect(nodeRadius({ type: "note" }, 0)).toBe(4);
    expect(GRAPH_TYPE_LABEL.note).toBe("노트");
  });

  it("sits in the 자료 column with papers and seminars", () => {
    const x = paraXByType(paraColumns(GRAPH_NODE_TYPE_ORDER));
    expect(x.note).toBe(x.paper);
    expect(x.note).toBe(x.seminar);
  });

  it("has a ▼ chip icon in the node color", () => {
    const html = renderToStaticMarkup(
      createElement(ShapeIcon, { type: "note", theme: GRAPH_THEME_LIGHT, color: "#773a10" }),
    );
    expect(html).toContain('d="M5 9.2 9.4 1.4H0.6Z"');
    expect(html).toContain('fill="#773a10"');
  });

  it("every node type has a chip icon", () => {
    for (const type of GRAPH_NODE_TYPE_ORDER) {
      const html = renderToStaticMarkup(
        createElement(ShapeIcon, { type, theme: GRAPH_THEME_LIGHT }),
      );
      expect(html, type).toContain("<svg");
    }
  });
});
