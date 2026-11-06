/**
 * Imports a learning roadmap JSON (made by Claude Code) into the DB.
 *
 *   npm run roadmap:import <file.json>
 *
 * The file is validated against the roadmap contract; anything off-contract is rejected
 * (exit 1). The same slug updates in place: titles, descriptions and resources are
 * overwritten, the status of a node at the same title path is kept, missing nodes are
 * deleted and new ones start as todo. Prints counts only.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { eq, inArray } from "drizzle-orm";
import { createDb, type Db } from "../src/db/config";
import { loadEnvIfPresent } from "../src/db/env";
import { learningRoadmaps, roadmapNodes } from "../src/db/schema";
import {
  parseRoadmapJson,
  type RoadmapInput,
  type RoadmapItemInput,
} from "../src/lib/roadmap/contract";

export type ImportResult = {
  created: boolean;
  added: number;
  updated: number;
  removed: number;
};

/** Validates JSON text and imports it; off-contract input changes nothing. */
export async function importRoadmapJson(
  db: Db,
  json: string,
): Promise<{ ok: true; result: ImportResult } | { ok: false; errors: string[] }> {
  const parsed = parseRoadmapJson(json);
  if (!parsed.ok) return parsed;
  return { ok: true, result: await importRoadmap(db, parsed.roadmap) };
}

/** A node's identity across imports: its title and every ancestor title. */
function pathKey(path: string[]): string {
  return JSON.stringify(path.map((title) => title.normalize("NFC")));
}

type NodeRow = typeof roadmapNodes.$inferSelect;

/** Inserts or updates a roadmap by slug; see the file header for the update rules. */
export async function importRoadmap(db: Db, data: RoadmapInput): Promise<ImportResult> {
  return db.transaction(async (tx) => {
    const now = new Date().toISOString();
    const [existing] = await tx
      .select()
      .from(learningRoadmaps)
      .where(eq(learningRoadmaps.slug, data.slug));

    const roadmapId = existing?.id ?? crypto.randomUUID();
    const fields = { title: data.title, topic: data.topic, summary: data.summary, updatedAt: now };
    if (existing) {
      await tx.update(learningRoadmaps).set(fields).where(eq(learningRoadmaps.id, roadmapId));
    } else {
      await tx
        .insert(learningRoadmaps)
        .values({ id: roadmapId, slug: data.slug, createdAt: now, ...fields });
    }

    // Index existing nodes by title path (first one wins on duplicate paths).
    const oldRows: NodeRow[] = existing
      ? await tx.select().from(roadmapNodes).where(eq(roadmapNodes.roadmapId, roadmapId))
      : [];
    const byId = new Map(oldRows.map((r) => [r.id, r]));
    const oldByPath = new Map<string, NodeRow>();
    const pathOf = (row: NodeRow): string[] => {
      const path: string[] = [];
      for (let r: NodeRow | undefined = row; r; r = r.parentId ? byId.get(r.parentId) : undefined) {
        path.unshift(r.title.normalize("NFC"));
      }
      return path;
    };
    for (const row of oldRows) {
      const key = pathKey(pathOf(row));
      if (!oldByPath.has(key)) oldByPath.set(key, row);
    }

    const kept = new Set<string>();
    let added = 0;
    let updated = 0;

    async function upsert(
      path: string[],
      parentId: string | null,
      position: number,
      node: Pick<NodeRow, "kind" | "title" | "description" | "priority" | "resources">,
    ): Promise<string> {
      const old = oldByPath.get(pathKey(path));
      if (old && !kept.has(old.id)) {
        kept.add(old.id);
        updated++;
        await tx
          .update(roadmapNodes)
          .set({ ...node, parentId, position, updatedAt: now })
          .where(eq(roadmapNodes.id, old.id));
        return old.id;
      }
      const id = crypto.randomUUID();
      added++;
      await tx.insert(roadmapNodes).values({
        id,
        roadmapId,
        parentId,
        position,
        status: "todo",
        createdAt: now,
        updatedAt: now,
        ...node,
      });
      return id;
    }

    async function importItems(items: RoadmapItemInput[], parentPath: string[], parentId: string) {
      for (const [i, item] of items.entries()) {
        const path = [...parentPath, item.title];
        const id = await upsert(path, parentId, i, {
          kind: "item",
          title: item.title,
          description: item.description,
          priority: item.priority,
          resources: item.resources,
        });
        await importItems(item.children, path, id);
      }
    }

    for (const [i, stage] of data.stages.entries()) {
      const path = [stage.title];
      const id = await upsert(path, null, i, {
        kind: "stage",
        title: stage.title,
        description: stage.description,
        priority: null,
        resources: [],
      });
      await importItems(stage.items, path, id);
    }

    const gone = oldRows.filter((r) => !kept.has(r.id)).map((r) => r.id);
    if (gone.length > 0) await tx.delete(roadmapNodes).where(inArray(roadmapNodes.id, gone));

    return { created: !existing, added, updated, removed: gone.length };
  });
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("사용법: npm run roadmap:import <file.json>");
    process.exit(1);
  }
  loadEnvIfPresent();
  const out = await importRoadmapJson(createDb(), readFileSync(resolve(file), "utf8"));
  if (!out.ok) {
    console.error("가져오기 거절: JSON 형식이 계약과 다릅니다.");
    for (const e of out.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const r = out.result;
  console.log(
    `${r.created ? "새 로드맵" : "로드맵 갱신"}: 추가 ${r.added} · 갱신 ${r.updated} · 삭제 ${r.removed}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error("가져오기 실패(script)");
    process.exit(1);
  });
}
