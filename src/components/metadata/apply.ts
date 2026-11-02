import type { PaperMetadata } from "@/lib/metadata/types";

/** Form-field values (strings) for a looked-up record; absent fields are left out. */
export type MetadataFields = {
  title: string;
  authors: string[];
  year?: string;
  venue?: string;
  doi?: string;
  url?: string;
};

export function metadataToFields(meta: PaperMetadata): MetadataFields {
  return {
    title: meta.title,
    authors: meta.authors,
    ...(meta.year !== null ? { year: String(meta.year) } : {}),
    ...(meta.venue ? { venue: meta.venue } : {}),
    ...(meta.doi ? { doi: meta.doi } : {}),
    ...(meta.url ? { url: meta.url } : {}),
  };
}

const TEXT_FIELDS = ["title", "year", "venue", "doi", "url"] as const;
type TextField = (typeof TEXT_FIELDS)[number];

/**
 * Server-side limits for each field (MAX_TITLE / MAX_TEXT in `@/app/_actions/parse`,
 * repeated here because that module is server-only). Used when an input has no
 * `maxLength` of its own, so a filled form never fails validation on save.
 */
export const FIELD_MAX_LENGTH: Record<TextField, number> = {
  title: 300,
  year: 4,
  venue: 2_000,
  doi: 2_000,
  url: 2_000,
};

/**
 * Cuts `value` to `maxLength` UTF-16 units (what `maxLength` counts) without splitting
 * a surrogate pair. A non-positive `maxLength` (the DOM's -1 for "unset") means no limit.
 */
export function fitToMaxLength(value: string, maxLength: number): string {
  if (maxLength <= 0 || value.length <= maxLength) return value;
  let end = maxLength;
  const code = value.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end--; // high surrogate without its pair
  return value.slice(0, end).trimEnd();
}

/** Value to write into the named field: the input's own `maxLength` wins, else the server limit. */
export function fieldValue(name: TextField, value: string, inputMaxLength = -1): string {
  const limit = inputMaxLength > 0 ? inputMaxLength : FIELD_MAX_LENGTH[name];
  return fitToMaxLength(value, limit);
}

/**
 * Writes looked-up values into an uncontrolled form's inputs by `name`
 * (title/year/venue/doi/url). Authors are not touched — `AuthorsField` keeps its
 * own state, so callers remount it with the new list. Values longer than the input's
 * `maxLength` (or the server limit) are cut so saving does not fail. Returns the fields written.
 */
export function applyMetadataToForm(form: HTMLFormElement, meta: PaperMetadata): string[] {
  const fields = metadataToFields(meta);
  const written: string[] = [];
  for (const name of TEXT_FIELDS) {
    const value = fields[name];
    const el = form.elements.namedItem(name);
    if (value === undefined) continue;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
    el.value = fieldValue(name, value, el.maxLength);
    written.push(name);
  }
  return written;
}
