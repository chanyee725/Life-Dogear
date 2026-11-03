import { describe, expect, it } from "vitest";
import {
  intrinsicValue,
  lonelyStars,
  neglectedImportant,
  pageRank,
  recencyValue,
  scoreGraph,
  scoreNode,
  STAR_FLOOR,
  topImportant,
  WEIGHTS,
  type ScoreInput,
} from "@/lib/cosmos/score";
import type { GraphNodeId } from "@/lib/graph/types";

const NOW = new Date("2026-11-03T12:00:00.000Z");
const id = (s: string) => s as GraphNodeId;
const input = (s: string, extra: Partial<ScoreInput> = {}): ScoreInput => ({
  id: id(s),
  type: s.split(":")[0] as ScoreInput["type"],
  archived: false,
  starred: false,
  lastActiveAt: null,
  ...extra,
});
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe("weights", () => {
  it("sum to 1", () => {
    expect(WEIGHTS.intrinsic + WEIGHTS.centrality + WEIGHTS.recency + WEIGHTS.star).toBeCloseTo(1);
  });
});

describe("intrinsicValue", () => {
  it("ranks papers by importance and goals by horizon", () => {
    expect(intrinsicValue(input("paper:a", { importance: "core" }), NOW)).toBe(1);
    expect(intrinsicValue(input("paper:a", { importance: "reference" }), NOW)).toBe(0.6);
    expect(intrinsicValue(input("paper:a", { importance: "light" }), NOW)).toBe(0.3);
    expect(intrinsicValue(input("goal:a", { horizon: "life" }), NOW)).toBe(1);
    expect(intrinsicValue(input("goal:a", { horizon: "year" }), NOW)).toBe(0.8);
    expect(intrinsicValue(input("goal:a", { horizon: "quarter" }), NOW)).toBe(0.6);
    expect(intrinsicValue(input("goal:a", { horizon: "year", status: "achieved" }), NOW)).toBe(0.4);
  });

  it("gives active projects a deadline bonus that grows as the due date nears", () => {
    const p = (dueDate: string | null, status = "active") =>
      intrinsicValue(input("project:a", { status, dueDate }), NOW);
    expect(p(null)).toBe(0.7);
    expect(p("2026-12-31")).toBe(0.7); // outside 14 days
    expect(p("2026-11-10")).toBeCloseTo(0.7 + 0.3 * 0.5); // 7 days left
    expect(p("2026-11-03")).toBeCloseTo(1); // due today
    expect(p("2026-10-01")).toBeCloseTo(1); // overdue keeps the full bonus
    expect(p("2026-11-03", "done")).toBe(0.25);
    expect(p("2026-11-03", "on_hold")).toBeCloseTo(0.65);
  });

  it("covers the other kinds", () => {
    expect(intrinsicValue(input("thought:a", { maturity: "refined" }), NOW)).toBe(0.7);
    expect(intrinsicValue(input("thought:a"), NOW)).toBe(0.3);
    expect(intrinsicValue(input("area:a"), NOW)).toBe(0.6);
    expect(intrinsicValue(input("seminar:a"), NOW)).toBe(0.4);
    expect(intrinsicValue(input("review:a"), NOW)).toBe(0.3);
    expect(intrinsicValue(input("tag:a"), NOW)).toBe(0.2);
  });
});

describe("recencyValue", () => {
  it("halves every 30 days", () => {
    expect(recencyValue(NOW.toISOString(), NOW)).toBe(1);
    expect(recencyValue(daysAgo(30), NOW)).toBeCloseTo(0.5);
    expect(recencyValue(daysAgo(60), NOW)).toBeCloseTo(0.25);
    expect(recencyValue(null, NOW)).toBe(0);
    expect(recencyValue("not a date", NOW)).toBe(0);
    expect(recencyValue("2027-01-01T00:00:00.000Z", NOW)).toBe(1); // future: treated as now
  });
});

describe("scoreNode", () => {
  it("combines the parts with the weights", () => {
    const s = scoreNode(
      input("paper:a", { importance: "core", lastActiveAt: daysAgo(30) }),
      0.5,
      NOW,
    );
    expect(s.score).toBeCloseTo(0.3 * 1 + 0.3 * 0.5 + 0.25 * 0.5);
  });

  it("keeps starred items at least at the floor and halves archived ones", () => {
    const starred = scoreNode(input("thought:a", { starred: true }), 0, NOW);
    expect(starred.score).toBe(STAR_FLOOR);
    const archived = scoreNode(input("thought:a", { starred: true, archived: true }), 0, NOW);
    expect(archived.score).toBeCloseTo(STAR_FLOOR / 2);
  });

  it("stays within 0..1", () => {
    const s = scoreNode(
      input("goal:a", { horizon: "life", starred: true, lastActiveAt: NOW.toISOString() }),
      5,
      NOW,
    );
    expect(s.score).toBe(1);
  });
});

describe("pageRank", () => {
  it("puts the hub first, normalised to 1", () => {
    const ids = ["a", "b", "c", "d"].map((s) => id(`paper:${s}`));
    const pr = pageRank(ids, [
      { source: ids[0]!, target: ids[1]! },
      { source: ids[0]!, target: ids[2]! },
      { source: ids[0]!, target: ids[3]! },
    ]);
    expect(pr.get(ids[0]!)).toBe(1);
    expect(pr.get(ids[1]!)).toBeLessThan(1);
    expect(pr.get(ids[1]!)).toBeCloseTo(pr.get(ids[2]!)!);
  });

  it("is zero for a graph without edges and ignores duplicates, loops and unknown ends", () => {
    const ids = [id("paper:a"), id("paper:b")];
    expect([...pageRank(ids, []).values()]).toEqual([0, 0]);
    const pr = pageRank(ids, [
      { source: ids[0]!, target: ids[1]! },
      { source: ids[1]!, target: ids[0]! },
      { source: ids[0]!, target: ids[0]! },
      { source: ids[0]!, target: id("paper:zzz") },
    ]);
    expect(pr.get(ids[0]!)).toBeCloseTo(pr.get(ids[1]!)!);
    expect(pageRank([], []).size).toBe(0);
  });
});

describe("panel lists", () => {
  const inputs = [
    input("goal:life", { horizon: "life", lastActiveAt: daysAgo(1) }),
    input("project:p", { status: "active", lastActiveAt: daysAgo(2) }),
    input("paper:core-old", { importance: "core", lastActiveAt: daysAgo(90) }),
    input("paper:light-old", { importance: "light", lastActiveAt: daysAgo(90) }),
    input("thought:alone", { lastActiveAt: daysAgo(10) }),
    input("seminar:alone-older", { lastActiveAt: daysAgo(40) }),
    input("tag:t"),
  ];
  const edges = [
    { source: id("project:p"), target: id("goal:life") },
    { source: id("paper:core-old"), target: id("project:p") },
    { source: id("paper:light-old"), target: id("project:p") },
  ];
  const scored = scoreGraph(inputs, edges, NOW);

  it("scores and counts degree per node", () => {
    expect(scored.get(id("project:p"))!.degree).toBe(3);
    expect(scored.get(id("thought:alone"))!.degree).toBe(0);
    expect(scored.get(id("project:p"))!.centrality).toBe(1);
  });

  it("lists the top nodes by score", () => {
    const top = topImportant(scored.values(), 3).map((s) => s.id);
    expect(top[0]).toBe("project:p");
    expect(top).toHaveLength(3);
  });

  it("lists unconnected nodes, oldest first, without topics", () => {
    expect(lonelyStars(scored.values()).map((s) => s.id)).toEqual([
      "seminar:alone-older",
      "thought:alone",
    ]);
  });

  it("lists important nodes untouched for 60+ days", () => {
    expect(neglectedImportant(scored.values(), NOW).map((s) => s.id)).toEqual(["paper:core-old"]);
  });
});
