import "server-only";
import { eq, like } from "drizzle-orm";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { isUuid, parseRef, pickItem, SHORT_ID_LENGTH, type ItemPathKind } from "./item-path";

export type ItemRouteKind = Exclude<ItemPathKind, "tags">;

const TABLES = {
  notes: schema.notes,
  projects: schema.projects,
  areas: schema.areas,
  goals: schema.goals,
  papers: schema.papers,
  seminars: schema.seminars,
  thoughts: schema.thoughts,
  reviews: schema.reviews,
} as const;

function decodeParam(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

/** Looks up the item behind a detail param; null when it does not resolve. */
export const lookupItemParam = cache(async (kind: ItemRouteKind, rawParam: string) => {
  const param = decodeParam(rawParam).normalize("NFC");
  const ref = parseRef(param);
  if (!ref) return null;
  const table = TABLES[kind];
  // Only 8 lowercase hex chars ever reach LIKE (parseRef guarantees it): no wildcards to escape.
  const prefix =
    ref.kind === "short" ? ref.short : isUuid(ref.id) ? ref.id.slice(0, SHORT_ID_LENGTH) : null;
  const where = prefix ? like(table.id, `${prefix}%`) : eq(table.id, (ref as { id: string }).id);
  const rows = await getDb().select({ id: table.id, title: table.title }).from(table).where(where);
  const pick = pickItem(param, ref, rows);
  return pick ? { ...pick, param } : null;
});

/**
 * Resolves `/<kind>/<param><suffix>` to the item's full id. Unknown or ambiguous refs → 404;
 * a valid ref that is not the canonical `<slug>-<shortid>` (old full-UUID URL, stale slug)
 * → 308 to the canonical path on this site.
 */
export async function resolveItemRoute(
  kind: ItemRouteKind,
  rawParam: string,
  suffix = "",
): Promise<string> {
  const hit = await lookupItemParam(kind, rawParam);
  if (!hit) notFound();
  if (hit.param !== hit.segment) {
    permanentRedirect(`/${kind}/${encodeURIComponent(hit.segment)}${suffix}`);
  }
  return hit.id;
}

/** For generateMetadata: the full id or null, never redirects. */
export async function itemIdForMetadata(kind: ItemRouteKind, rawParam: string) {
  return (await lookupItemParam(kind, rawParam))?.id ?? null;
}
