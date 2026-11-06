import { asc, desc, eq } from "drizzle-orm";
import { learningRoadmaps, roadmapNodes } from "@/db/schema";
import { db, nowIso, serializeWrite } from "./shared";
import {
  ROADMAP_NODE_STATUSES,
  type RoadmapNodeKind,
  type RoadmapNodePriority,
  type RoadmapNodeStatus,
  type RoadmapNodeView,
  type RoadmapProgress,
  type RoadmapResourceView,
  type RoadmapSummary,
  type RoadmapTree,
} from "./learningRoadmap-types";

export type * from "./learningRoadmap-types";

/** A `roadmap_nodes` row as the assembler needs it. */
export type RoadmapNodeRow = {
  id: string;
  parentId: string | null;
  kind: RoadmapNodeKind;
  title: string;
  description: string;
  priority: RoadmapNodePriority | null;
  resources: unknown;
  status: RoadmapNodeStatus;
  position: number;
};

export const isNodeStatus = (value: unknown): value is RoadmapNodeStatus =>
  typeof value === "string" && (ROADMAP_NODE_STATUSES as readonly string[]).includes(value);

/** Accepts the stored JSON (string or already parsed); drops malformed entries. */
function parseResources(value: unknown): RoadmapResourceView[] {
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list.filter(
    (r): r is RoadmapResourceView =>
      !!r &&
      typeof r === "object" &&
      typeof (r as RoadmapResourceView).title === "string" &&
      typeof (r as RoadmapResourceView).url === "string" &&
      typeof (r as RoadmapResourceView).kind === "string",
  );
}

const addProgress = (a: RoadmapProgress, b: RoadmapProgress): RoadmapProgress => ({
  done: a.done + b.done,
  total: a.total + b.total,
});

/**
 * Builds stage → item → children from flat node rows (pure; exported for tests).
 * Roots are rows without a parent; siblings follow `position`. Rows whose parent is
 * missing are dropped. Progress counts items only (stages are containers).
 */
export function assembleNodes(rows: RoadmapNodeRow[]): {
  stages: RoadmapNodeView[];
  progress: RoadmapProgress;
} {
  const byParent = new Map<string | null, RoadmapNodeRow[]>();
  for (const row of rows) {
    const list = byParent.get(row.parentId) ?? [];
    list.push(row);
    byParent.set(row.parentId, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.position - b.position);

  const seen = new Set<string>();
  const build = (row: RoadmapNodeRow): RoadmapNodeView => {
    seen.add(row.id);
    const children = (byParent.get(row.id) ?? []).filter((c) => !seen.has(c.id)).map(build);
    const progress = children.reduce<RoadmapProgress>(
      (acc, c) =>
        addProgress(
          acc,
          addProgress(
            c.progress,
            c.kind === "item"
              ? { done: c.status === "done" ? 1 : 0, total: 1 }
              : { done: 0, total: 0 },
          ),
        ),
      { done: 0, total: 0 },
    );
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      description: row.description,
      priority: row.kind === "stage" ? null : row.priority,
      resources: parseResources(row.resources),
      status: row.status,
      progress,
      children,
    };
  };

  const stages = (byParent.get(null) ?? []).map(build);
  const progress = stages.reduce<RoadmapProgress>((acc, s) => addProgress(acc, s.progress), {
    done: 0,
    total: 0,
  });
  return { stages, progress };
}

const nodeColumns = {
  id: roadmapNodes.id,
  parentId: roadmapNodes.parentId,
  kind: roadmapNodes.kind,
  title: roadmapNodes.title,
  description: roadmapNodes.description,
  priority: roadmapNodes.priority,
  resources: roadmapNodes.resources,
  status: roadmapNodes.status,
  position: roadmapNodes.position,
};

/** All roadmaps, most recently updated first, with item progress. */
export async function listRoadmaps(): Promise<RoadmapSummary[]> {
  const roadmaps = await db()
    .select()
    .from(learningRoadmaps)
    .orderBy(desc(learningRoadmaps.updatedAt), asc(learningRoadmaps.title));
  const nodes = await db()
    .select({
      roadmapId: roadmapNodes.roadmapId,
      kind: roadmapNodes.kind,
      status: roadmapNodes.status,
    })
    .from(roadmapNodes);
  const progress = new Map<string, RoadmapProgress>();
  for (const n of nodes) {
    if (n.kind !== "item") continue;
    const p = progress.get(n.roadmapId) ?? { done: 0, total: 0 };
    p.total += 1;
    if (n.status === "done") p.done += 1;
    progress.set(n.roadmapId, p);
  }
  return roadmaps.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    topic: r.topic,
    summary: r.summary,
    updatedAt: r.updatedAt,
    progress: progress.get(r.id) ?? { done: 0, total: 0 },
  }));
}

/** One roadmap with its full node tree, or null when the slug is unknown. */
export async function getRoadmapTree(slug: string): Promise<RoadmapTree | null> {
  const [roadmap] = await db()
    .select()
    .from(learningRoadmaps)
    .where(eq(learningRoadmaps.slug, slug))
    .limit(1);
  if (!roadmap) return null;
  const rows = await db()
    .select(nodeColumns)
    .from(roadmapNodes)
    .where(eq(roadmapNodes.roadmapId, roadmap.id));
  const { stages, progress } = assembleNodes(rows as RoadmapNodeRow[]);
  return {
    id: roadmap.id,
    slug: roadmap.slug,
    title: roadmap.title,
    topic: roadmap.topic,
    summary: roadmap.summary,
    createdAt: roadmap.createdAt,
    updatedAt: roadmap.updatedAt,
    progress,
    stages,
  };
}

/** Sets a node's status; false when the node does not exist. */
export function setNodeStatus(nodeId: string, status: RoadmapNodeStatus): Promise<boolean> {
  return serializeWrite(async () => {
    const updated = await db()
      .update(roadmapNodes)
      .set({ status, updatedAt: nowIso() })
      .where(eq(roadmapNodes.id, nodeId))
      .returning({ id: roadmapNodes.id });
    return updated.length > 0;
  });
}

/** Deletes a roadmap and its nodes; false when it does not exist. */
export function deleteRoadmap(id: string): Promise<boolean> {
  return serializeWrite(() =>
    db().transaction(async (tx) => {
      await tx.delete(roadmapNodes).where(eq(roadmapNodes.roadmapId, id));
      const deleted = await tx
        .delete(learningRoadmaps)
        .where(eq(learningRoadmaps.id, id))
        .returning({ id: learningRoadmaps.id });
      return deleted.length > 0;
    }),
  );
}
