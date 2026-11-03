import { describe, expect, it } from "vitest";
import {
  centralityScores,
  directValue,
  importanceScore,
  lonelyStars,
  rescore,
  neglectedImportant,
  recencyValue,
  scoreGraph,
  STAR_FLOOR,
  topImportant,
  WEIGHTS,
  type ScoreInput,
} from "@/lib/cosmos/score";
import type { GraphEdge, GraphNodeId } from "@/lib/graph/types";

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
const r3 = (n: number) => Math.round(n * 1000) / 1000;

describe("weights", () => {
  it("are 0.40 / 0.25 / 0.20 / 0.15", () => {
    expect(WEIGHTS).toEqual({ direct: 0.4, centrality: 0.25, recency: 0.2, star: 0.15 });
    expect(STAR_FLOOR).toBe(0.7);
  });
});

describe("design 8.6 reference values", () => {
  it("core paper, centrality 0.5, 15 days ago → 0.626", () => {
    const s = importanceScore(
      input("paper:a", { importance: "core", lastActiveAt: daysAgo(15) }),
      0.5,
      NOW,
    );
    expect(r3(s.recency)).toBe(0.707);
    expect(r3(s.score)).toBe(0.626);
  });

  it("active project due in 7 days, centrality 1, today → 0.81", () => {
    const s = importanceScore(
      input("project:a", {
        status: "active",
        dueDate: "2026-11-10",
        lastActiveAt: NOW.toISOString(),
      }),
      1,
      NOW,
    );
    expect(s.direct).toBeCloseTo(0.9);
    expect(r3(s.score)).toBe(0.81);
  });

  it("seed thought, alone, 90 days ago, starred → 0.70", () => {
    const s = importanceScore(
      input("thought:a", { maturity: "seed", starred: true, lastActiveAt: daysAgo(90) }),
      0,
      NOW,
    );
    expect(r3(s.recency)).toBe(0.125);
    expect(r3(s.score)).toBe(0.7);
  });

  it("light paper, archived, centrality 0.2, 60 days ago → 0.09", () => {
    const s = importanceScore(
      input("paper:a", { importance: "light", archived: true, lastActiveAt: daysAgo(60) }),
      0.2,
      NOW,
    );
    expect(r3(s.score)).toBe(0.09);
  });
});

describe("directValue (8.2)", () => {
  const d = (s: string, extra: Partial<ScoreInput> = {}) => directValue(input(s, extra), NOW);
  it("goals by horizon and status", () => {
    expect(d("goal:a", { horizon: "life" })).toBe(1);
    expect(d("goal:a", { horizon: "year" })).toBe(0.8);
    expect(d("goal:a", { horizon: "quarter" })).toBe(0.65);
    expect(d("goal:a", { horizon: "year", status: "achieved" })).toBeCloseTo(0.48);
    expect(d("goal:a", { horizon: "life", status: "dropped" })).toBeCloseTo(0.2);
  });

  it("projects: active 0.6 (+0.3 within 14 days or overdue), on hold 0.3, done 0.25", () => {
    expect(d("project:a", { status: "active" })).toBe(0.6);
    expect(d("project:a", { status: "active", dueDate: "2026-11-30" })).toBe(0.6);
    expect(d("project:a", { status: "active", dueDate: "2026-11-17" })).toBeCloseTo(0.9);
    expect(d("project:a", { status: "active", dueDate: "2026-01-01" })).toBeCloseTo(0.9);
    expect(d("project:a", { status: "on_hold", dueDate: "2026-11-04" })).toBe(0.3);
    expect(d("project:a", { status: "done", dueDate: "2026-11-04" })).toBe(0.25);
  });

  it("papers, thoughts and the rest", () => {
    expect(d("paper:a", { importance: "core" })).toBe(0.9);
    expect(d("paper:a", { importance: "reference" })).toBe(0.5);
    expect(d("paper:a", { importance: "light" })).toBe(0.2);
    expect(d("thought:a", { maturity: "seed" })).toBe(0.3);
    expect(d("thought:a", { maturity: "growing" })).toBe(0.45);
    expect(d("thought:a", { maturity: "refined" })).toBe(0.6);
    expect(d("area:a")).toBe(0.6);
    expect(d("seminar:a")).toBe(0.4);
    expect(d("review:a")).toBe(0.2);
    expect(d("tag:a")).toBe(0.15);
  });
});

describe("recencyValue (8.4)", () => {
  const rv = (type: string, at: string | null) =>
    recencyValue({ type: type as ScoreInput["type"], lastActiveAt: at }, NOW);
  it("halves every 30 days, future counts as now, unknown is 0", () => {
    expect(rv("paper", daysAgo(30))).toBeCloseTo(0.5);
    expect(rv("paper", daysAgo(60))).toBeCloseTo(0.25);
    expect(rv("paper", daysAgo(90))).toBeCloseTo(0.125);
    expect(rv("paper", "2027-01-01T00:00:00.000Z")).toBe(1);
    expect(rv("paper", null)).toBe(0);
    expect(rv("paper", "nope")).toBe(0);
  });

  it("pins goals and areas to 0.5", () => {
    expect(rv("goal", daysAgo(400))).toBe(0.5);
    expect(rv("area", NOW.toISOString())).toBe(0.5);
  });
});

describe("centralityScores (8.3)", () => {
  const ids = ["a", "b", "c", "d", "e", "f"].map((s) => id(`paper:${s}`));
  const e = (i: number, j: number, kind: GraphEdge["kind"] = "link"): GraphEdge => ({
    source: ids[i]!,
    target: ids[j]!,
    kind,
  });

  it("puts the hub at 1 with sqrt normalisation", () => {
    const c = centralityScores(ids, [e(0, 1), e(0, 2), e(0, 3), e(0, 4), e(0, 5)]);
    expect(c.get(ids[0]!)).toBe(1);
    const leaf = c.get(ids[1]!)!;
    expect(leaf).toBeGreaterThan(0);
    expect(leaf).toBeLessThan(1);
    // sqrt spreads small values: a leaf's raw PageRank share is well below its centrality.
    expect(leaf ** 2).toBeLessThan(leaf);
  });

  it("weights belongs over links over topics", () => {
    const strong = centralityScores(ids, [e(0, 1, "belongs"), e(0, 2, "topic"), e(3, 4), e(4, 5)]);
    expect(strong.get(ids[1]!)!).toBeGreaterThan(strong.get(ids[2]!)!);
  });

  it("uses sqrt(degree / max) below 5 nodes and 0 without edges", () => {
    const small = ids.slice(0, 3);
    const c = centralityScores(small, [e(0, 1), e(0, 2)]);
    expect(c.get(small[0]!)).toBe(1);
    expect(c.get(small[1]!)).toBeCloseTo(Math.sqrt(0.5));
    expect([...centralityScores(ids, []).values()].every((v) => v === 0)).toBe(true);
    expect(centralityScores([], []).size).toBe(0);
  });
});

describe("panel lists (7.3)", () => {
  const inputs = [
    input("goal:life", { horizon: "life" }),
    input("project:p", { status: "active", lastActiveAt: daysAgo(2) }),
    input("paper:core-old", { importance: "core", lastActiveAt: daysAgo(90), starred: true }),
    input("paper:core-older", { importance: "core", lastActiveAt: daysAgo(120), starred: true }),
    input("paper:light-old", { importance: "light", lastActiveAt: daysAgo(90) }),
    input("thought:alone", { lastActiveAt: daysAgo(10) }),
    input("seminar:alone-older", { lastActiveAt: daysAgo(40) }),
    input("review:r"),
    input("tag:t"),
  ];
  const edges: GraphEdge[] = [
    { source: id("project:p"), target: id("goal:life"), kind: "belongs" },
    { source: id("paper:core-old"), target: id("project:p"), kind: "link" },
    { source: id("paper:core-older"), target: id("project:p"), kind: "link" },
    { source: id("paper:light-old"), target: id("project:p"), kind: "link" },
  ];
  const scored = scoreGraph(inputs, edges, NOW);

  it("counts degree per node", () => {
    expect(scored.get(id("project:p"))!.degree).toBe(4);
    expect(scored.get(id("thought:alone"))!.degree).toBe(0);
  });

  it("Top 10 leaves the life goal out", () => {
    const top = topImportant(scored.values()).map((s) => s.id);
    expect(top).not.toContain("goal:life");
    expect(top).toHaveLength(8);
  });

  it("lonely stars: no reviews or topics, most recently edited first", () => {
    expect(lonelyStars(scored.values()).map((s) => s.id)).toEqual([
      "thought:alone",
      "seminar:alone-older",
    ]);
  });

  it("neglected: score ≥ 0.55 and over 45 days, oldest first", () => {
    expect(neglectedImportant(scored.values(), NOW).map((s) => s.id)).toEqual([
      "paper:core-older",
      "paper:core-old",
    ]);
  });
});

describe("rescore", () => {
  it("matches importanceScore for the same parts", () => {
    const i = input("paper:a", { importance: "core", lastActiveAt: daysAgo(15) });
    const base = importanceScore(i, 0.5, NOW);
    expect(rescore(base, false, false)).toBeCloseTo(base.score);
    const starred = importanceScore({ ...i, starred: true }, 0.5, NOW);
    expect(rescore(base, true, false)).toBeCloseTo(starred.score);
    const archived = importanceScore({ ...i, starred: true, archived: true }, 0.5, NOW);
    expect(rescore(base, true, true)).toBeCloseTo(archived.score);
  });
});
