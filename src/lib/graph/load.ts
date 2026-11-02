import "server-only";
import {
  areas,
  goals,
  itemTags,
  links,
  papers,
  projects,
  reviews,
  seminars,
  tags,
  thoughts,
} from "@/db/schema";
import { listPositions } from "@/lib/repo/graph-layout";
import { db } from "@/lib/repo/shared";
import { buildGraph, buildLocalGraph, type GraphSource, type SourceItem } from "./build";
import type { GraphData, GraphFilter, GraphNodeId, GraphResponse } from "./types";

/**
 * Loads every row the graph needs with a fixed number of queries (one per table),
 * independent of the number of items — never one query per node.
 */
export async function loadGraphSource(options: { tags?: boolean } = {}): Promise<GraphSource> {
  const d = db();
  const [
    goalRows,
    areaRows,
    projectRows,
    paperRows,
    seminarRows,
    thoughtRows,
    reviewRows,
    linkRows,
  ] = await Promise.all([
    d
      .select({
        id: goals.id,
        title: goals.title,
        archivedAt: goals.archivedAt,
        areaId: goals.areaId,
        parentId: goals.parentId,
        horizon: goals.horizon,
        period: goals.period,
      })
      .from(goals),
    d.select({ id: areas.id, title: areas.title, archivedAt: areas.archivedAt }).from(areas),
    d
      .select({
        id: projects.id,
        title: projects.title,
        archivedAt: projects.archivedAt,
        areaId: projects.areaId,
        goalId: projects.goalId,
      })
      .from(projects),
    d.select({ id: papers.id, title: papers.title, archivedAt: papers.archivedAt }).from(papers),
    d
      .select({ id: seminars.id, title: seminars.title, archivedAt: seminars.archivedAt })
      .from(seminars),
    d
      .select({ id: thoughts.id, title: thoughts.title, archivedAt: thoughts.archivedAt })
      .from(thoughts),
    d
      .select({
        id: reviews.id,
        title: reviews.title,
        archivedAt: reviews.archivedAt,
        period: reviews.period,
      })
      .from(reviews),
    d
      .select({
        sourceType: links.sourceType,
        sourceId: links.sourceId,
        targetType: links.targetType,
        targetId: links.targetId,
        via: links.via,
      })
      .from(links),
  ]);

  const items: SourceItem[] = [];
  type Row = { id: string; title: string; archivedAt: string | null };
  const push = <R extends Row>(
    type: SourceItem["type"],
    rows: R[],
    extra?: (r: R) => Partial<SourceItem>,
  ) => {
    for (const r of rows) {
      items.push({
        type,
        id: r.id,
        title: r.title,
        archived: r.archivedAt !== null,
        ...extra?.(r),
      });
    }
  };
  push("goal", goalRows, (r) => ({
    areaId: r.areaId,
    parentGoalId: r.parentId,
    horizon: r.horizon,
    period: r.period,
  }));
  push("area", areaRows);
  push("project", projectRows, (r) => ({ areaId: r.areaId, goalId: r.goalId }));
  push("paper", paperRows);
  push("seminar", seminarRows);
  push("thought", thoughtRows);
  push("review", reviewRows, (r) => ({ period: r.period }));

  const source: GraphSource = { items, links: linkRows };
  if (options.tags) {
    const [tagRows, taggingRows] = await Promise.all([
      d.select({ id: tags.id, name: tags.name }).from(tags),
      d
        .select({ itemType: itemTags.itemType, itemId: itemTags.itemId, tagId: itemTags.tagId })
        .from(itemTags),
    ]);
    source.tags = tagRows;
    source.itemTags = taggingRows;
  }
  return source;
}

/** Filtered graph plus saved positions of the returned nodes (stale positions are dropped). */
export async function getGraph(filter: GraphFilter = {}): Promise<GraphResponse> {
  const needsTags = Boolean(filter.tag) || Boolean(filter.types?.includes("tag"));
  const [source, positions] = await Promise.all([
    loadGraphSource({ tags: needsTags }),
    listPositions(),
  ]);
  const graph = buildGraph(source, filter);
  const shown = new Set(graph.nodes.map((n) => n.id));
  return { ...graph, positions: positions.filter((p) => shown.has(p.node)) };
}

export async function getLocalGraph(center: GraphNodeId, depth: 1 | 2): Promise<GraphData> {
  return buildLocalGraph(await loadGraphSource(), center, depth);
}
