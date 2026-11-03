import "server-only";
/**
 * Data for `GET /api/graph/cosmos`: the filtered graph (`getGraph`, read-only reuse) plus
 * the importance score, galaxy and side-panel lists. Fixed query count: the graph's own
 * queries, one narrow select per item table for the score inputs, and one for stars.
 */
import { asc } from "drizzle-orm";
import {
  areas,
  goals,
  itemStars,
  papers,
  projects,
  reviews,
  seminars,
  thoughts,
} from "@/db/schema";
import { getGraph } from "@/lib/graph/load";
import type { GraphFilter, GraphNodeId } from "@/lib/graph/types";
import { db } from "@/lib/repo/shared";
import { assignGalaxies } from "./galaxy";
import {
  lonelyStars,
  neglectedImportant,
  scoreGraph,
  topImportant,
  type ScoreInput,
} from "./score";
import type { CosmosNodeInfo, CosmosResponse } from "./types";

type Signal = Omit<ScoreInput, "id" | "type" | "archived" | "starred">;

/** The later of two ISO times (either may be null). */
const latest = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

async function loadSignals(): Promise<{
  signals: Map<string, Signal>;
  starred: Set<string>;
  areaOrder: { id: string; title: string }[];
}> {
  const d = db();
  const [
    goalRows,
    areaRows,
    projectRows,
    paperRows,
    seminarRows,
    thoughtRows,
    reviewRows,
    starRows,
  ] = await Promise.all([
    d
      .select({
        id: goals.id,
        horizon: goals.horizon,
        status: goals.status,
        updatedAt: goals.updatedAt,
      })
      .from(goals),
    d
      .select({ id: areas.id, title: areas.title, updatedAt: areas.updatedAt })
      .from(areas)
      .orderBy(asc(areas.sortOrder), asc(areas.id)),
    d
      .select({
        id: projects.id,
        status: projects.status,
        dueDate: projects.dueDate,
        updatedAt: projects.updatedAt,
      })
      .from(projects),
    d
      .select({
        id: papers.id,
        importance: papers.importance,
        updatedAt: papers.updatedAt,
        lastReadAt: papers.lastReadAt,
      })
      .from(papers),
    d.select({ id: seminars.id, updatedAt: seminars.updatedAt }).from(seminars),
    d
      .select({ id: thoughts.id, maturity: thoughts.maturity, updatedAt: thoughts.updatedAt })
      .from(thoughts),
    d.select({ id: reviews.id, updatedAt: reviews.updatedAt }).from(reviews),
    d.select({ type: itemStars.itemType, id: itemStars.itemId }).from(itemStars),
  ]);

  const signals = new Map<string, Signal>();
  for (const r of goalRows)
    signals.set(`goal:${r.id}`, {
      lastActiveAt: r.updatedAt,
      horizon: r.horizon,
      status: r.status,
    });
  for (const r of areaRows) signals.set(`area:${r.id}`, { lastActiveAt: r.updatedAt });
  for (const r of projectRows)
    signals.set(`project:${r.id}`, {
      lastActiveAt: r.updatedAt,
      status: r.status,
      dueDate: r.dueDate,
    });
  for (const r of paperRows)
    signals.set(`paper:${r.id}`, {
      lastActiveAt: latest(r.updatedAt, r.lastReadAt),
      importance: r.importance,
    });
  for (const r of seminarRows) signals.set(`seminar:${r.id}`, { lastActiveAt: r.updatedAt });
  for (const r of thoughtRows)
    signals.set(`thought:${r.id}`, { lastActiveAt: r.updatedAt, maturity: r.maturity });
  for (const r of reviewRows) signals.set(`review:${r.id}`, { lastActiveAt: r.updatedAt });

  return {
    signals,
    starred: new Set(starRows.map((r) => `${r.type}:${r.id}`)),
    areaOrder: areaRows.map((r) => ({ id: r.id, title: r.title })),
  };
}

export async function getCosmos(
  filter: GraphFilter = {},
  now = new Date(),
): Promise<CosmosResponse> {
  const [graph, { signals, starred, areaOrder }] = await Promise.all([
    getGraph(filter),
    loadSignals(),
  ]);

  const inputs: ScoreInput[] = graph.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    archived: n.archived,
    starred: starred.has(n.id),
    lastActiveAt: null,
    ...signals.get(n.id),
  }));
  const scored = scoreGraph(inputs, graph.edges, now);
  const galaxies = assignGalaxies(
    graph.nodes,
    graph.edges,
    areaOrder.map((a) => a.id),
  );

  const cosmos = {} as Record<GraphNodeId, CosmosNodeInfo>;
  for (const n of graph.nodes) {
    const s = scored.get(n.id)!;
    cosmos[n.id] = {
      score: s.score,
      direct: s.direct,
      centrality: s.centrality,
      recency: s.recency,
      starred: starred.has(n.id),
      galaxy: galaxies.get(n.id) ?? null,
      lastActiveAt: s.lastActiveAt,
    };
  }
  const used = new Set([...galaxies.values()].filter((g): g is string => g !== null));

  return {
    ...graph,
    cosmos,
    galaxies: areaOrder.filter((a) => used.has(a.id)),
    top: topImportant(scored.values()).map((s) => s.id),
    lonely: lonelyStars(scored.values()).map((s) => s.id),
    neglected: neglectedImportant(scored.values(), now).map((s) => s.id),
  };
}
