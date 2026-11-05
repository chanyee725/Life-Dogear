/**
 * Canonical detail URLs: `/<kind>/<slug>-<shortid>`.
 *
 * - shortid: first 8 hex chars of the item's UUID (lowercase).
 * - slug: lowercased title, letters/digits of any script kept (\p{L}\p{N}), everything
 *   else collapsed to single '-', trimmed, max 60 chars. Empty title → shortid only.
 *
 * Non-UUID ids (`seed-…` sample data) have no shortid: their path stays `/<kind>/<id>`.
 * Tags are name-based (`/tags/<name>`), not id-based: use `tagPath(name)`.
 *
 * Pure functions only: safe to import from server and client code.
 */

export type ItemPathKind =
  | "notes"
  | "projects"
  | "areas"
  | "goals"
  | "papers"
  | "seminars"
  | "thoughts"
  | "reviews"
  | "tags";

export type ItemRefParam = { kind: "short"; short: string } | { kind: "uuid"; id: string };

export const SLUG_MAX_LENGTH = 60;
export const SHORT_ID_LENGTH = 8;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_SUFFIX_RE = /(?:^|-)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const SHORT_SUFFIX_RE = /(?:^|-)([0-9a-f]{8})$/;
const SEED_RE = /^seed-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PARAM_LENGTH = 400;

export function isUuid(id: string): boolean {
  return UUID_RE.test(id.toLowerCase());
}

export function slugify(title: string): string {
  const base = (title ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  // Cut by code point so a surrogate pair is never split, then re-trim the edge.
  return Array.from(base).slice(0, SLUG_MAX_LENGTH).join("").replace(/-+$/, "");
}

/** First 8 hex chars of a UUID; non-UUID ids (seed data) are returned unchanged. */
export function shortId(id: string): string {
  const lower = id.toLowerCase();
  return UUID_RE.test(lower) ? lower.slice(0, SHORT_ID_LENGTH) : id;
}

/** Path segment for an item: `<slug>-<shortid>`, or the full UUID when `full` is set. */
export function itemSegment(id: string, title?: string | null, full = false): string {
  const lower = id.toLowerCase();
  if (!UUID_RE.test(lower)) return id;
  const tail = full ? lower : lower.slice(0, SHORT_ID_LENGTH);
  const slug = slugify(title ?? "");
  return slug ? `${slug}-${tail}` : tail;
}

export function itemPath(kind: ItemPathKind, id: string, title?: string | null): string {
  if (kind === "tags") return tagPath(id);
  return `/${kind}/${itemSegment(id, title)}`;
}

/** Tags are addressed by name. */
export function tagPath(name: string): string {
  return `/tags/${encodeURIComponent(name)}`;
}

/**
 * Parses a detail route param. Accepts `…-<8 hex>`, `<8 hex>`, `…-<full uuid>`, `<full uuid>`
 * and bare seed ids (returned as `uuid`, i.e. an exact id). Anything else → null (404).
 * Expects the decoded param (Next passes it percent-decoded).
 */
export function parseRef(param: string): ItemRefParam | null {
  if (typeof param !== "string" || !param || param.length > MAX_PARAM_LENGTH) return null;
  let value = param;
  if (/%[0-9a-f]{2}/i.test(value)) {
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  const lower = value.toLowerCase();
  const uuid = UUID_SUFFIX_RE.exec(lower);
  if (uuid) return { kind: "uuid", id: uuid[1] };
  const short = SHORT_SUFFIX_RE.exec(lower);
  if (short) return { kind: "short", short: short[1] };
  if (SEED_RE.test(value)) return { kind: "uuid", id: value };
  return null;
}

export type ItemPick = { id: string; segment: string };

/**
 * Picks the item a parsed param points at among `rows` (every row whose id starts with
 * the ref's 8-char prefix, or the exact id for seed refs) and returns its canonical segment.
 * When two UUIDs share the prefix, the short form is ambiguous: the canonical segment uses
 * the full UUID, and a short param only resolves if its slug matches exactly one of them.
 */
export function pickItem(
  param: string,
  ref: ItemRefParam,
  rows: readonly { id: string; title?: string | null }[],
): ItemPick | null {
  const uuids = rows.filter((r) => isUuid(r.id));
  const collides = uuids.length > 1;
  const segmentOf = (r: { id: string; title?: string | null }) =>
    itemSegment(r.id, r.title, collides && isUuid(r.id));

  let hit: { id: string; title?: string | null } | undefined;
  if (ref.kind === "uuid") {
    hit = rows.find((r) => r.id.toLowerCase() === ref.id.toLowerCase());
  } else {
    const matching = uuids.filter((r) => r.id.toLowerCase().startsWith(ref.short));
    if (matching.length === 1) hit = matching[0];
    else if (matching.length > 1) {
      const slug = param.toLowerCase().slice(0, -(SHORT_ID_LENGTH + 1));
      const bySlug = matching.filter((r) => slugify(r.title ?? "") === slug);
      if (bySlug.length === 1) hit = bySlug[0];
    }
  }
  return hit ? { id: hit.id, segment: segmentOf(hit) } : null;
}
