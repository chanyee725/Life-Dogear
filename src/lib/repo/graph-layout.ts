import { sql } from "drizzle-orm";
import { graphLayout } from "@/db/schema";
import type { GraphNodeId, GraphNodeType, GraphPosition } from "@/lib/graph/types";
import { db, nowIso, serializeWrite, withTx } from "./shared";

/** Rows per INSERT, well under SQLite's bound-variable limit (5 columns each). */
const CHUNK = 500;

/**
 * All saved positions. Rows can outlive deleted items (no FK), so callers keep only
 * positions of nodes they actually return.
 */
export async function listPositions(): Promise<GraphPosition[]> {
  const rows = await db().select().from(graphLayout);
  return rows.map((r) => ({ node: `${r.nodeType}:${r.nodeId}` as GraphNodeId, x: r.x, y: r.y }));
}

/** Upserts positions in one transaction. Ids must already be validated (`parseLayoutBody`). */
export async function savePositions(positions: readonly GraphPosition[]): Promise<number> {
  if (!positions.length) return 0;
  const updatedAt = nowIso();
  const rows = positions.map((p) => {
    const at = p.node.indexOf(":");
    return {
      // Item types and topic nodes (`tag`); ids were validated by `parseLayoutBody`.
      nodeType: p.node.slice(0, at) as GraphNodeType,
      nodeId: p.node.slice(at + 1),
      x: p.x,
      y: p.y,
      updatedAt,
    };
  });
  await withTx(async (tx) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      await tx
        .insert(graphLayout)
        .values(rows.slice(i, i + CHUNK))
        .onConflictDoUpdate({
          target: [graphLayout.nodeType, graphLayout.nodeId],
          set: {
            x: sql`excluded.x`,
            y: sql`excluded.y`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }
  });
  return rows.length;
}

/** "초기화": forgets every pinned position. */
export async function clearPositions(): Promise<void> {
  await serializeWrite(() => db().delete(graphLayout));
}
