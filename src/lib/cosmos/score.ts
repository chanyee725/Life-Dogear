/**
 * Importance score (0..1) for the cosmos view (docs/PLAN-COSMOS.md C2). Pure: no DB, no
 * clock (pass `now`). The weights and curves are exported so docs/design/cosmos.md can
 * quote them as values.
 *
 *   score = W.intrinsic·intrinsic + W.centrality·centrality + W.recency·recency + W.star·star
 *   starred items never fall below STAR_FLOOR; archived items are halved.
 */
import type { GraphNodeId, GraphNodeType } from "@/lib/graph/types";

export const WEIGHTS = { intrinsic: 0.3, centrality: 0.3, recency: 0.25, star: 0.15 } as const;
/** A starred item is always at least this important. */
export const STAR_FLOOR = 0.6;
export const ARCHIVED_FACTOR = 0.5;
/** Recency halves every this many days since the last read/edit. */
export const RECENCY_HALF_LIFE_DAYS = 30;
/** A project due within this many days gets the deadline bonus (full when due/overdue). */
export const DEADLINE_WINDOW_DAYS = 14;

/** What the score looks at for one node (the cosmos loader fills it from item rows). */
export type ScoreInput = {
  id: GraphNodeId;
  type: GraphNodeType;
  archived: boolean;
  starred: boolean;
  /** ISO time of the last edit or read; null when unknown. */
  lastActiveAt: string | null;
  /** paper: `core` | `reference` | `light`. */
  importance?: string;
  /** goal: `life` | `year` | `quarter`. */
  horizon?: string;
  /** goal: `active` | `achieved` | `dropped`; project: `active` | `on_hold` | `done`. */
  status?: string;
  /** project: `YYYY-MM-DD`. */
  dueDate?: string | null;
  /** thought: `seed` | `growing` | `refined`. */
  maturity?: string;
};

export type ScoreParts = {
  intrinsic: number;
  centrality: number;
  recency: number;
  star: number;
  score: number;
};

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const DAY_MS = 86_400_000;

function daysBetween(fromIso: string, now: Date): number | null {
  const t = Date.parse(fromIso);
  return Number.isNaN(t) ? null : (now.getTime() - t) / DAY_MS;
}

/** Days from `now` until a `YYYY-MM-DD` date (negative when past); null when invalid. */
function daysUntil(date: string, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const due = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return (due - today) / DAY_MS;
}

/** The item's own weight, before connections and activity. */
export function intrinsicValue(input: ScoreInput, now: Date): number {
  switch (input.type) {
    case "paper":
      return input.importance === "core" ? 1 : input.importance === "light" ? 0.3 : 0.6;
    case "goal": {
      const base = input.horizon === "life" ? 1 : input.horizon === "year" ? 0.8 : 0.6;
      return input.status === "achieved" || input.status === "dropped" ? base * 0.5 : base;
    }
    case "project": {
      const base = input.status === "done" ? 0.25 : input.status === "on_hold" ? 0.35 : 0.7;
      if (input.status === "done" || !input.dueDate) return base;
      const left = daysUntil(input.dueDate, now);
      if (left === null || left > DEADLINE_WINDOW_DAYS) return base;
      // Linear bonus up to +0.3 as the deadline nears; overdue keeps the full bonus.
      return clamp01(base + 0.3 * (1 - Math.max(left, 0) / DEADLINE_WINDOW_DAYS));
    }
    case "area":
      return 0.6;
    case "seminar":
      return 0.4;
    case "thought":
      return input.maturity === "refined" ? 0.7 : input.maturity === "growing" ? 0.5 : 0.3;
    case "review":
      return 0.3;
    case "tag":
      return 0.2;
  }
}

/** 1 now, 0.5 after one half-life, → 0. Unknown or future times count as now / 0. */
export function recencyValue(lastActiveAt: string | null, now: Date): number {
  if (!lastActiveAt) return 0;
  const age = daysBetween(lastActiveAt, now);
  if (age === null) return 0;
  return clamp01(Math.pow(0.5, Math.max(age, 0) / RECENCY_HALF_LIFE_DAYS));
}

export function scoreNode(input: ScoreInput, centrality: number, now: Date): ScoreParts {
  const intrinsic = intrinsicValue(input, now);
  const recency = recencyValue(input.lastActiveAt, now);
  const star = input.starred ? 1 : 0;
  const c = clamp01(centrality);
  let score =
    WEIGHTS.intrinsic * intrinsic +
    WEIGHTS.centrality * c +
    WEIGHTS.recency * recency +
    WEIGHTS.star * star;
  if (input.starred) score = Math.max(score, STAR_FLOOR);
  if (input.archived) score *= ARCHIVED_FACTOR;
  return { intrinsic, centrality: c, recency, star, score: clamp01(score) };
}

/**
 * PageRank on the undirected graph (damping 0.85), normalised so the top node is 1.
 * Dangling (isolated) nodes spread their rank evenly. Fixed iterations: O(iter·(n+e)).
 */
export function pageRank(
  ids: readonly GraphNodeId[],
  edges: readonly { source: GraphNodeId; target: GraphNodeId }[],
  { damping = 0.85, iterations = 30 }: { damping?: number; iterations?: number } = {},
): Map<GraphNodeId, number> {
  const n = ids.length;
  const out = new Map<GraphNodeId, number>();
  if (n === 0) return out;
  const index = new Map(ids.map((id, i) => [id, i]));
  const adj: number[][] = ids.map(() => []);
  const seen = new Set<string>();
  for (const e of edges) {
    const a = index.get(e.source);
    const b = index.get(e.target);
    if (a === undefined || b === undefined || a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    adj[a]!.push(b);
    adj[b]!.push(a);
  }
  let rank = new Float64Array(n).fill(1 / n);
  for (let it = 0; it < iterations; it++) {
    const next = new Float64Array(n);
    let dangling = 0;
    for (let i = 0; i < n; i++) {
      const deg = adj[i]!.length;
      if (deg === 0) {
        dangling += rank[i]!;
        continue;
      }
      const share = rank[i]! / deg;
      for (const j of adj[i]!) next[j]! += share;
    }
    const base = (1 - damping) / n + (damping * dangling) / n;
    for (let i = 0; i < n; i++) next[i] = base + damping * next[i]!;
    rank = next;
  }
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, rank[i]!);
  // A graph with no edges has no "central" node.
  const flat = seen.size === 0;
  ids.forEach((id, i) => out.set(id, flat || max === 0 ? 0 : rank[i]! / max));
  return out;
}

export type ScoredNode = ScoreParts & {
  id: GraphNodeId;
  degree: number;
  lastActiveAt: string | null;
};

/** Scores every node: centrality from PageRank over the given edges. */
export function scoreGraph(
  inputs: readonly ScoreInput[],
  edges: readonly { source: GraphNodeId; target: GraphNodeId }[],
  now: Date,
): Map<GraphNodeId, ScoredNode> {
  const ids = inputs.map((i) => i.id);
  const pr = pageRank(ids, edges);
  const degree = new Map<GraphNodeId, number>();
  const pairs = new Set<string>();
  for (const e of edges) {
    if (e.source === e.target || !pr.has(e.source) || !pr.has(e.target)) continue;
    const key = e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`;
    if (pairs.has(key)) continue;
    pairs.add(key);
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const out = new Map<GraphNodeId, ScoredNode>();
  for (const input of inputs) {
    out.set(input.id, {
      id: input.id,
      degree: degree.get(input.id) ?? 0,
      lastActiveAt: input.lastActiveAt,
      ...scoreNode(input, pr.get(input.id) ?? 0, now),
    });
  }
  return out;
}

// ---------- Side panel lists ----------

/** Highest scores first (ties: more connections, then id). */
export function topImportant(scored: Iterable<ScoredNode>, limit = 10): ScoredNode[] {
  return [...scored]
    .sort((a, b) => b.score - a.score || b.degree - a.degree || (a.id < b.id ? -1 : 1))
    .slice(0, limit);
}

/** Unconnected nodes ("외톨이 별"), least recently touched first. Topics are left out. */
export function lonelyStars(scored: Iterable<ScoredNode>, limit = 10): ScoredNode[] {
  return [...scored]
    .filter((s) => s.degree === 0 && !s.id.startsWith("tag:"))
    .sort(
      (a, b) =>
        (a.lastActiveAt ?? "").localeCompare(b.lastActiveAt ?? "") || (a.id < b.id ? -1 : 1),
    )
    .slice(0, limit);
}

export const NEGLECTED_MIN_DAYS = 60;
export const NEGLECTED_MIN_IMPORTANCE = 0.5;

/**
 * Important but untouched: importance without the recency part (intrinsic, centrality,
 * star — renormalised) ≥ 0.5 and not read or edited for 60+ days. Most important first.
 */
export function neglectedImportant(
  scored: Iterable<ScoredNode>,
  now: Date,
  limit = 10,
): ScoredNode[] {
  const rest = WEIGHTS.intrinsic + WEIGHTS.centrality + WEIGHTS.star;
  const withoutRecency = (s: ScoredNode) =>
    (WEIGHTS.intrinsic * s.intrinsic + WEIGHTS.centrality * s.centrality + WEIGHTS.star * s.star) /
    rest;
  return [...scored]
    .filter((s) => {
      if (s.id.startsWith("tag:")) return false;
      const age = s.lastActiveAt ? daysBetween(s.lastActiveAt, now) : null;
      return (
        age !== null && age >= NEGLECTED_MIN_DAYS && withoutRecency(s) >= NEGLECTED_MIN_IMPORTANCE
      );
    })
    .sort((a, b) => withoutRecency(b) - withoutRecency(a) || (a.id < b.id ? -1 : 1))
    .slice(0, limit);
}
