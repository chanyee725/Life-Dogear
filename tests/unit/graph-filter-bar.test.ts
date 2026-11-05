import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GraphFilterControls, hiddenFilterCount } from "@/components/graph/GraphFilterBar";
import { GRAPH_THEME_LIGHT } from "@/components/graph/graph-theme";
import { DotIcon } from "@/components/graph/ShapeIcon";
import type { GraphNodeType } from "@/lib/graph/types";

describe("compact graph filter bar", () => {
  it("counts only the conditions behind the 필터 button", () => {
    expect(hiddenFilterCount({})).toBe(0);
    // Type chips and 완료 포함 stay in the row, so they are not counted.
    expect(hiddenFilterCount({ types: ["goal"], doneTasks: true })).toBe(0);
    expect(hiddenFilterCount({ area: "a", tag: "t", archived: true, orphans: true })).toBe(4);
  });
});

describe("graph filter chip icons (legend, graph.md 1.4)", () => {
  const html = (colorBy?: "kind" | "area") =>
    renderToStaticMarkup(
      createElement(GraphFilterControls, {
        filter: {},
        onChange: () => {},
        options: { areas: [], tags: [] },
        theme: GRAPH_THEME_LIGHT,
        colorBy,
      }),
      // The Select chevrons (lucide) are not chip icons.
    ).replace(/<svg[^>]*class="lucide[^"]*"[^>]*>.*?<\/svg>/g, "");

  it("draws canvas-matching dots on the 2D graph, never ■◆▲▼ shapes", () => {
    for (const colorBy of ["kind", "area"] as const) {
      const out = html(colorBy);
      expect(out).not.toMatch(/<path|<rect/);
      expect(out).toContain('data-dot="filled"');
      expect(out).toContain('data-dot="hollow"');
    }
  });

  it("keeps shape icons for the cosmos view (no colorBy)", () => {
    expect(html()).toMatch(/<path|<rect/);
  });
});

describe("DotIcon", () => {
  const dot = (type: GraphNodeType, horizon?: "quarter" | "year") =>
    renderToStaticMarkup(createElement(DotIcon, { type, horizon, color: "#123456" }));

  it("is hollow for open items, filled otherwise; areas are larger", () => {
    for (const t of ["thought", "tag", "task"] as const) expect(dot(t)).toContain('fill="none"');
    expect(dot("goal", "quarter")).toContain('fill="none"');
    for (const t of ["goal", "area", "project", "paper", "seminar", "note", "review"] as const)
      expect(dot(t)).toContain('fill="#123456"');
    const r = (s: string) => Number(/ r="([\d.]+)"/.exec(s)?.[1]);
    expect(r(dot("area"))).toBeGreaterThan(r(dot("project")));
  });
});
