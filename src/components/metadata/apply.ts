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

/**
 * Writes looked-up values into an uncontrolled form's inputs by `name`
 * (title/year/venue/doi/url). Authors are not touched — `AuthorsField` keeps its
 * own state, so callers remount it with the new list. Returns the fields written.
 */
export function applyMetadataToForm(form: HTMLFormElement, meta: PaperMetadata): string[] {
  const fields = metadataToFields(meta);
  const written: string[] = [];
  for (const name of TEXT_FIELDS) {
    const value = fields[name];
    const el = form.elements.namedItem(name);
    if (value === undefined) continue;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
    el.value = value;
    written.push(name);
  }
  return written;
}
