/**
 * Importance score (0..1) for the cosmos view — docs/design/cosmos.md 8절. Pure: no DB,
 * no clock (pass `now`).
 *
 *   score = 0.40·direct + 0.25·centrality + 0.20·recency + 0.15·starred
 *   starred → at least 0.70; archived → × 0.5; clamped to 0..1.
 *
 * Scores are computed on the graph as shown (after filters); centrality is normalised
 * within it.
 */
import type { GraphEdgeKind, GraphNodeId, GraphNodeType } from "@/lib/graph/types";

export const WEIGHTS = { direct: 0.4, centrality: 0.25, recency: 0.2, star: 0.15 } as const;
export const STAR_FLOOR = 0.7;
export const ARCHIVED_FACTOR = 0.5;
export const RECENCY_HALF_LIFE_DAYS = 30;
/** Goals and areas are long-lived structure: recency is pinned to this value. */
export const STRUCTURE_RECENCY = 0.5;
export const DEADLINE_WINDOW_DAYS = 14;
export const DEADLINE_BONUS = 0.3;
/** PageRank edge weights by kind. */
export const EDGE_WEIGHT: Record<GraphEdgeKind, number> = {
  belongs: 1,
  link: 0.8,
  body: 0.8,
  topic: 0.3,
};
/** Below this many nodes, centrality uses degree instead of PageRank. */
export const PAGERANK_MIN_NODES = 5;

/** What the score looks at for one node (the cosmos loader fills it from item rows). */
export type ScoreInput = {
  id: GraphNodeId;
  type: GraphNodeType;
  archived: boolean;
  starred: boolean;
  /** max(updated_at, last_read_at); null when unknown. */
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
  direct: number;
  centrality: number;
  recency: number;
  starred: boolean;
  score: number;
};

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const DAY_MS = 86_400_000;

function ageDays(iso: string, now: Date): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : (now.getTime() - t) / DAY_MS;
}

/** Whole days from today (UTC) until a `YYYY-MM-DD` date; negative when past. */
function daysUntil(date: string, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const due = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return (due - today) / DAY_MS;
}

/** 8.2 direct value. */
export function directValue(input: ScoreInput, now: Date): number {
  switch (input.type) {
    case "goal": {
      const base = input.horizon === "life" ? 1 : input.horizon === "year" ? 0.8 : 0.65;
      if (input.status === "achieved") return base * 0.6;
      if (input.status === "dropped") return base * 0.2;
      return base;
    }
    case "area":
      return 0.6;
    case "project": {
      if (input.status === "done") return 0.25;
      if (input.status === "on_hold") return 0.3;
      const left = input.dueDate ? daysUntil(input.dueDate, now) : null;
      const bonus = left !== null && left <= DEADLINE_WINDOW_DAYS ? DEADLINE_BONUS : 0;
      return clamp01(0.6 + bonus);
    }
    case "paper":
      return input.importance === "core" ? 0.9 : input.importance === "light" ? 0.2 : 0.5;
    case "seminar":
      return 0.4;
    case "thought":
      return input.maturity === "refined" ? 0.6 : input.maturity === "growing" ? 0.45 : 0.3;
    case "review":
      return 0.2;
    case "tag":
      return 0.15;
  }
}

/** 8.4: halves every 30 days; future → 1; unknown → 0. Goals and areas: 0.5. */
export function recencyValue(input: Pick<ScoreInput, "type" | "lastActiveAt">, now: Date): number {
  if (input.type === "goal" || input.type === "area") return STRUCTURE_RECENCY;
  if (!input.lastActiveAt) return 0;
  const t = ageDays(input.lastActiveAt, now);
  if (t === null) return 0;
  return clamp01(Math.pow(0.5, Math.max(t, 0) / RECENCY_HALF_LIFE_DAYS));
}

/** 8.1. `centrality` is already normalised to 0..1. */
export function importanceScore(input: ScoreInput, centrality: number, now: Date): ScoreParts {
  const direct = directValue(input, now);
  const recency = recencyValue(input, now);
  const c = clamp01(centrality);
  let score =
    WEIGHTS.direct * direct +
    WEIGHTS.centrality * c +
    WEIGHTS.recency * recency +
    WEIGHTS.star * (input.starred ? 1 : 0);
  if (input.starred) score = Math.max(score, STAR_FLOOR);
  if (input.archived) score *= ARCHIVED_FACTOR;
  return { direct, centrality: c, recency, starred: input.starred, score: clamp01(score) };
}

type WeightedEdge = { source: GraphNodeId; target: GraphNodeId; kind?: GraphEdgeKind };

/** Undirected weighted adjacency; duplicate pairs keep the heaviest edge; loops dropped. */
function adjacency(ids: readonly GraphNodeId[], edges: readonly WeightedEdge[]) {
  const index = new Map(ids.map((id, i) => [id, i]));
  const pairs = new Map<string, { a: number; b: number; w: number }>();
  for (const e of edges) {
    const a = index.get(e.source);
    const b = index.get(e.target);
    if (a === undefined || b === undefined || a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const w = e.kind ? EDGE_WEIGHT[e.kind] : 1;
    const old = pairs.get(key);
    if (!old || w > old.w) pairs.set(key, { a, b, w });
  }
  const adj: { j: number; w: number }[][] = ids.map(() => []);
  for (const { a, b, w } of pairs.values()) {
    adj[a]!.push({ j: b, w });
    adj[b]!.push({ j: a, w });
  }
  return { adj, edgeCount: pairs.size };
}

/**
 * 8.3 centrality per node, 0..1: weighted undirected PageRank (damping 0.85, ≤ 40
 * iterations or total change < 1e-6), normalised `sqrt(pr / max)`. Fewer than 5 nodes:
 * `sqrt(degree / max degree)`. No edges: 0.
 */
export function centralityScores(
  ids: readonly GraphNodeId[],
  edges: readonly WeightedEdge[],
  { damping = 0.85, maxIterations = 40, tolerance = 1e-6 } = {},
): Map<GraphNodeId, number> {
  const n = ids.length;
  const out = new Map<GraphNodeId, number>();
  const { adj, edgeCount } = adjacency(ids, edges);
  if (n === 0) return out;
  if (edgeCount === 0) {
    for (const id of ids) out.set(id, 0);
    return out;
  }
  if (n < PAGERANK_MIN_NODES) {
    const maxDeg = Math.max(...adj.map((a) => a.length));
    ids.forEach((id, i) => out.set(id, Math.sqrt(adj[i]!.length / maxDeg)));
    return out;
  }

  const strength = adj.map((list) => list.reduce((s, e) => s + e.w, 0));
  let rank = new Float64Array(n).fill(1 / n);
  for (let it = 0; it < maxIterations; it++) {
    const next = new Float64Array(n);
    let dangling = 0;
    for (let i = 0; i < n; i++) {
      if (strength[i] === 0) {
        dangling += rank[i]!;
        continue;
      }
      for (const { j, w } of adj[i]!) next[j]! += (rank[i]! * w) / strength[i]!;
    }
    const base = (1 - damping) / n + (damping * dangling) / n;
    let delta = 0;
    for (let i = 0; i < n; i++) {
      next[i] = base + damping * next[i]!;
      delta += Math.abs(next[i]! - rank[i]!);
    }
    rank = next;
    if (delta < tolerance) break;
  }
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, rank[i]!);
  ids.forEach((id, i) => out.set(id, max > 0 ? Math.sqrt(rank[i]! / max) : 0));
  return out;
}

export type ScoredNode = ScoreParts & {
  id: GraphNodeId;
  type: GraphNodeType;
  horizon?: string;
  status?: string;
  degree: number;
  lastActiveAt: string | null;
};

/** Scores every node of the shown graph. */
export function scoreGraph(
  inputs: readonly ScoreInput[],
  edges: readonly WeightedEdge[],
  now: Date,
): Map<GraphNodeId, ScoredNode> {
  const ids = inputs.map((i) => i.id);
  const centrality = centralityScores(ids, edges);
  const { adj } = adjacency(ids, edges);
  const out = new Map<GraphNodeId, ScoredNode>();
  inputs.forEach((input, i) => {
    out.set(input.id, {
      id: input.id,
      type: input.type,
      horizon: input.horizon,
      status: input.status,
      degree: adj[i]!.length,
      lastActiveAt: input.lastActiveAt,
      ...importanceScore(input, centrality.get(input.id) ?? 0, now),
    });
  });
  return out;
}

// ---------- Side panel lists (7.3) ----------

const byId = (a: ScoredNode, b: ScoredNode) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** 중요한 별 Top 10: highest score first, life goals left out (they are the sun). */
export function topImportant(scored: Iterable<ScoredNode>, limit = 10): ScoredNode[] {
  return [...scored]
    .filter((s) => !(s.type === "goal" && s.horizon === "life"))
    .sort((a, b) => b.score - a.score || b.degree - a.degree || byId(a, b))
    .slice(0, limit);
}

/** 외톨이 별: no edges, reviews and topics left out, most recently edited first. */
export function lonelyStars(scored: Iterable<ScoredNode>): ScoredNode[] {
  return [...scored]
    .filter((s) => s.degree === 0 && s.type !== "review" && s.type !== "tag")
    .sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "") || byId(a, b));
}

export const NEGLECTED_MIN_SCORE = 0.55;
export const NEGLECTED_MIN_DAYS = 45;

/** 오래 손대지 않은 중요한 별: score ≥ 0.55, inactive > 45 days, no goals/areas; oldest first. */
export function neglectedImportant(
  scored: Iterable<ScoredNode>,
  now: Date,
  limit = 5,
): ScoredNode[] {
  return [...scored]
    .filter((s) => {
      if (s.type === "goal" || s.type === "area" || s.type === "tag") return false;
      if (s.score < NEGLECTED_MIN_SCORE || !s.lastActiveAt) return false;
      const t = ageDays(s.lastActiveAt, now);
      return t !== null && t > NEGLECTED_MIN_DAYS;
    })
    .sort((a, b) => (a.lastActiveAt ?? "").localeCompare(b.lastActiveAt ?? "") || byId(a, b))
    .slice(0, limit);
}
