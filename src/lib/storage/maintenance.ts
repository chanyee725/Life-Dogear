import type { BlobStore } from "./blob";
import { imageContentType, isImageName } from "./images";

/**
 * One-off storage chores for the CLI scripts (`storage:push`, `storage:gc-images`).
 * Results are counts only: no file names, keys or endpoints are ever printed.
 */

export type PushResult = { uploaded: number; skipped: number; failed: number };

/** Copies local photos and PDFs to the bucket; keys already there are left alone. */
export async function pushLocalFiles(
  local: BlobStore,
  remote: BlobStore,
  options: { dryRun?: boolean } = {},
): Promise<PushResult> {
  const result: PushResult = { uploaded: 0, skipped: 0, failed: 0 };
  for (const prefix of ["images/", "pdfs/"]) {
    for (const entry of await local.list(prefix)) {
      try {
        if (await remote.head(entry.key)) {
          result.skipped++;
          continue;
        }
        if (!options.dryRun) {
          const read = await local.get(entry.key);
          if (!read || !("body" in read)) continue; // removed meanwhile
          const bytes = new Uint8Array(await new Response(read.body).arrayBuffer());
          const type =
            prefix === "pdfs/" ? "application/pdf" : imageContentType(entry.key.slice(7));
          await remote.put(entry.key, bytes, type);
        }
        result.uploaded++;
      } catch {
        result.failed++;
      }
    }
  }
  return result;
}

const IMAGE_REF_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|gif|webp)/g;

/**
 * Photo names mentioned anywhere in the given text values. Matches bare names too (not only
 * `/api/images/...` URLs), so any odd reference keeps the photo: missing a deletion is safe,
 * deleting a photo still in use is not.
 */
export function referencedImages(values: Iterable<unknown>): Set<string> {
  const names = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    for (const [name] of value.matchAll(IMAGE_REF_RE)) names.add(name);
  }
  return names;
}

export const GC_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export type GcResult = {
  total: number;
  referenced: number;
  /** Unreferenced but newer than the minimum age (maybe in an unsaved draft). */
  tooNew: number;
  unreferenced: number;
  deleted: number;
  failed: number;
};

/**
 * Finds photos no body refers to and, with `apply`, deletes the ones older than `minAgeMs`.
 * Photos without a known creation time are kept.
 */
export async function gcImages(
  store: BlobStore,
  referenced: ReadonlySet<string>,
  options: { apply?: boolean; now?: Date; minAgeMs?: number } = {},
): Promise<GcResult> {
  const now = (options.now ?? new Date()).getTime();
  const minAge = options.minAgeMs ?? GC_MIN_AGE_MS;
  const result: GcResult = {
    total: 0,
    referenced: 0,
    tooNew: 0,
    unreferenced: 0,
    deleted: 0,
    failed: 0,
  };
  for (const entry of await store.list("images/")) {
    const name = entry.key.slice("images/".length);
    if (!isImageName(name)) continue;
    result.total++;
    if (referenced.has(name)) {
      result.referenced++;
      continue;
    }
    const created = entry.lastModified?.getTime();
    if (created === undefined || now - created < minAge) {
      result.tooNew++;
      continue;
    }
    result.unreferenced++;
    if (!options.apply) continue;
    try {
      if (await store.delete(entry.key)) result.deleted++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
