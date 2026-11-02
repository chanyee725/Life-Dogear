import { cleanText, toYear } from "./text";
import type { PaperMetadata } from "./types";

export const CROSSREF_API = "https://api.crossref.org/works/";

/** Crossref work URL. Each path segment is encoded; the DOI's `/` separators are kept. */
export function crossrefUrl(doi: string): string {
  return CROSSREF_API + doi.split("/").map(encodeURIComponent).join("/");
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? cleanText(v) : "");
const firstStr = (v: unknown): string =>
  Array.isArray(v) ? (v.map(str).find(Boolean) ?? "") : str(v);

function authorName(a: unknown): string {
  if (!isObj(a)) return "";
  const given = str(a.given);
  const family = str(a.family);
  if (given || family) return [given, family].filter(Boolean).join(" ");
  return str(a.name); // organisations
}

/** First year found in `issued`, then print/online publication, then `created`. */
function yearOf(m: Obj): number | null {
  for (const key of ["issued", "published", "published-print", "published-online", "created"]) {
    const parts = isObj(m[key]) ? (m[key] as Obj)["date-parts"] : undefined;
    if (Array.isArray(parts) && Array.isArray(parts[0])) {
      const year = toYear(parts[0][0]);
      if (year) return year;
    }
  }
  return null;
}

/**
 * Normalises a Crossref `/works/{doi}` JSON body. Returns null when it is not a
 * work record or has no title.
 */
export function normalizeCrossref(body: unknown): PaperMetadata | null {
  if (!isObj(body) || !isObj(body.message)) return null;
  const m = body.message;
  const title = firstStr(m.title);
  if (!title) return null;

  const authors = Array.isArray(m.author) ? m.author.map(authorName).filter(Boolean) : [];
  const venue = firstStr(m["container-title"]) || str(isObj(m.event) ? m.event.name : undefined);
  const doi = str(m.DOI);
  const url = str(m.URL);

  return {
    title,
    authors,
    year: yearOf(m),
    ...(venue ? { venue } : {}),
    ...(doi ? { doi } : {}),
    ...(url ? { url } : {}),
  };
}
