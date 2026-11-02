import "server-only";
import { areas, itemTags, links, papers, projects, seminars, tags, thoughts } from "@/db/schema";
import { db } from "@/lib/repo/shared";
import { buildGraph, buildLocalGraph, type GraphSource, type SourceItem } from "./build";
import type { GraphData, GraphFilter, GraphNodeId } from "./types";

/**
 * Loads every row the graph needs with a fixed number of queries (one per table),
 * independent of the number of items — never one query per node.
 */
export async function loadGraphSource(options: { tags?: boolean } = {}): Promise<GraphSource> {
  const d = db();
  const [areaRows, projectRows, paperRows, seminarRows, thoughtRows, linkRows] = await Promise.all([
    d.select({ id: areas.id, title: areas.title, archivedAt: areas.archivedAt }).from(areas),
    d
      .select({
        id: projects.id,
        title: projects.title,
        archivedAt: projects.archivedAt,
        areaId: projects.areaId,
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
        sourceType: links.sourceType,
        sourceId: links.sourceId,
        targetType: links.targetType,
        targetId: links.targetId,
      })
      .from(links),
  ]);

  const items: SourceItem[] = [];
  const push = (
    type: SourceItem["type"],
    rows: { id: string; title: string; archivedAt: string | null; areaId?: string | null }[],
  ) => {
    for (const r of rows) {
      items.push({
        type,
        id: r.id,
        title: r.title,
        archived: r.archivedAt !== null,
        areaId: r.areaId ?? null,
      });
    }
  };
  push("area", areaRows);
  push("project", projectRows);
  push("paper", paperRows);
  push("seminar", seminarRows);
  push("thought", thoughtRows);
  // Goals and reviews join here once their tables exist (schema 0002).

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

export async function getGraph(filter: GraphFilter = {}): Promise<GraphData> {
  const needsTags = Boolean(filter.tag) || Boolean(filter.types?.includes("tag"));
  return buildGraph(await loadGraphSource({ tags: needsTags }), filter);
}

export async function getLocalGraph(center: GraphNodeId, depth: 1 | 2): Promise<GraphData> {
  return buildLocalGraph(await loadGraphSource(), center, depth);
}
