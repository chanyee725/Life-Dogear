import { stripArxivVersion } from "./parse";
import { cleanText, toYear } from "./text";
import type { PaperMetadata } from "./types";

export const ARXIV_API = "https://export.arxiv.org/api/query";

export function arxivUrl(id: string): string {
  return `${ARXIV_API}?id_list=${encodeURIComponent(id)}&max_results=1`;
}

/**
 * Text of the first `<tag>` (any namespace prefix) inside `xml`, or null.
 * The arXiv Atom feed is flat and machine-generated, so a small scanner is enough —
 * no XML dependency. CDATA sections are unwrapped.
 */
function tagText(xml: string, tag: string): string | null {
  const m = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`).exec(
    xml,
  );
  return m ? unwrapCdata(m[1]) : null;
}

function allBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(
    `<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`,
    "g",
  );
  return Array.from(xml.matchAll(re), (m) => m[1]);
}

function unwrapCdata(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

export type ArxivParse =
  { ok: true; data: PaperMetadata } | { ok: false; reason: "not_found" | "parse_error" };

/**
 * Parses an arXiv API Atom response for one id. An unknown id yields no `<entry>`
 * or an error entry (id under `arxiv.org/api/errors`) → `not_found`; text that is
 * not an Atom feed → `parse_error`.
 */
export function parseArxivAtom(xml: string): ArxivParse {
  if (typeof xml !== "string" || !/<feed[\s>]/.test(xml))
    return { ok: false, reason: "parse_error" };
  const entry = allBlocks(xml, "entry")[0];
  if (entry === undefined) return { ok: false, reason: "not_found" };

  const entryId = cleanText(tagText(entry, "id") ?? "");
  if (/\/api\/errors/.test(entryId)) return { ok: false, reason: "not_found" };

  const title = cleanText(tagText(entry, "title") ?? "");
  if (!title) return { ok: false, reason: "parse_error" };

  const authors = allBlocks(entry, "author")
    .map((a) => cleanText(tagText(a, "name") ?? ""))
    .filter(Boolean);
  const published = cleanText(tagText(entry, "published") ?? "");
  const doi = cleanText(tagText(entry, "doi") ?? "");
  const venue = cleanText(tagText(entry, "journal_ref") ?? "");

  // Canonical abstract URL without the version, e.g. http://arxiv.org/abs/2101.00001v1.
  const idMatch = /arxiv\.org\/abs\/(.+)$/.exec(entryId);
  const url = idMatch ? `https://arxiv.org/abs/${stripArxivVersion(idMatch[1])}` : undefined;

  return {
    ok: true,
    data: {
      title,
      authors,
      year: toYear(published.slice(0, 4)),
      ...(venue ? { venue } : {}),
      ...(doi ? { doi } : {}),
      ...(url ? { url } : {}),
    },
  };
}
