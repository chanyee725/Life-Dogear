import type { Identifier } from "./types";

/** Longest input we try to interpret; anything longer is not a link or id. */
export const MAX_INPUT_LENGTH = 500;

const DOI_RE = /^10\.\d{4,9}\/\S+$/;
/** New-style arXiv id (2007+): `YYMM.NNNN` or `YYMM.NNNNN`, optional version. */
const ARXIV_NEW_RE = /^\d{4}\.\d{4,5}(?:v\d+)?$/;
/** Old-style arXiv id: `archive(.SUBJ)/YYMMNNN`, optional version. */
const ARXIV_OLD_RE = /^[a-z][a-z-]*(?:\.[a-z]{2})?\/\d{7}(?:v\d+)?$/i;
/** arXiv-registered DOIs: `10.48550/arXiv.<id>`. */
const ARXIV_DOI_RE = /^10\.48550\/arxiv\.(.+)$/i;

const DOI_HOSTS = new Set(["doi.org", "dx.doi.org", "www.doi.org"]);
const ARXIV_HOSTS = new Set(["arxiv.org", "www.arxiv.org", "export.arxiv.org"]);

export function isArxivId(value: string): boolean {
  return ARXIV_NEW_RE.test(value) || ARXIV_OLD_RE.test(value);
}

/** Old-style archive names are lower case (`hep-th`); the subject class is upper case. */
function normalizeArxivId(id: string): string {
  if (ARXIV_NEW_RE.test(id)) return id.toLowerCase();
  const [archive, rest] = id.split("/");
  const [name, subject] = archive.split(".");
  return `${name.toLowerCase()}${subject ? `.${subject.toUpperCase()}` : ""}/${rest.toLowerCase()}`;
}

/** Drops punctuation that sticks to a DOI copied from running text. */
function trimDoi(value: string): string {
  return value.replace(/[.,;:]+$/, "");
}

function fromDoi(raw: string): Identifier | null {
  const doi = trimDoi(raw);
  if (!DOI_RE.test(doi)) return null;
  const arxiv = ARXIV_DOI_RE.exec(doi);
  if (arxiv && isArxivId(arxiv[1])) return { kind: "arxiv", id: normalizeArxivId(arxiv[1]) };
  return { kind: "doi", doi };
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function fromUrl(text: string): Identifier | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();

  if (DOI_HOSTS.has(host)) {
    const path = safeDecode(url.pathname.slice(1));
    return path ? fromDoi(path) : null;
  }

  if (ARXIV_HOSTS.has(host)) {
    // /abs/<id>, /pdf/<id>, /pdf/<id>.pdf, /html/<id>
    const m = /^\/(?:abs|pdf|html)\/(.+?)(?:\.pdf)?\/?$/i.exec(url.pathname);
    if (!m) return null;
    const id = safeDecode(m[1]);
    return id && isArxivId(id) ? { kind: "arxiv", id: normalizeArxivId(id) } : null;
  }
  return null;
}

/**
 * Recognises a DOI or arXiv identifier in what the user pasted:
 * `10.1234/abc`, `doi:10.1234/abc`, `https://doi.org/10.1234/abc`,
 * `https://arxiv.org/abs/2101.00001v2`, `https://arxiv.org/pdf/2101.00001.pdf`,
 * `arXiv:2101.00001`, `2101.00001`, `hep-th/9901001`.
 * arXiv DOIs (`10.48550/arXiv.…`) are routed to arXiv. Returns null otherwise.
 */
export function parseIdentifier(input: string): Identifier | null {
  const text = input.trim();
  if (!text || text.length > MAX_INPUT_LENGTH) return null;

  if (/^https?:\/\//i.test(text)) return fromUrl(text);

  const doiPrefixed = /^doi:\s*(.+)$/i.exec(text);
  if (doiPrefixed) return fromDoi(doiPrefixed[1]);

  const arxivPrefixed = /^arxiv:\s*(.+)$/i.exec(text);
  if (arxivPrefixed) {
    const id = arxivPrefixed[1];
    return isArxivId(id) ? { kind: "arxiv", id: normalizeArxivId(id) } : null;
  }

  if (isArxivId(text)) return { kind: "arxiv", id: normalizeArxivId(text) };
  return fromDoi(text);
}

/** arXiv id without its version suffix, for the canonical abstract URL. */
export function stripArxivVersion(id: string): string {
  return id.replace(/v\d+$/, "");
}
