import { arxivUrl, parseArxivAtom } from "./arxiv";
import { crossrefUrl, normalizeCrossref } from "./crossref";
import { parseIdentifier, stripArxivVersion } from "./parse";
import type { FetchLike, Identifier, MetadataResult } from "./types";

export const DEFAULT_TIMEOUT_MS = 8_000;
/** Larger bodies are not bibliographic records we want to parse (a record is a few KB). */
export const MAX_RESPONSE_BYTES = 2_000_000;
/** Polite identification for Crossref/arXiv. App name only — no contact address. */
export const USER_AGENT = "ResearchBrain/0.1 (personal research notes app)";

export type LookupOptions = {
  fetch?: FetchLike;
  timeoutMs?: number;
  /** Byte limit for one response body (default MAX_RESPONSE_BYTES). */
  maxBytes?: number;
};

type Fetched = { ok: true; status: number; text: string } | Extract<MetadataResult, { ok: false }>;

class TooLarge extends Error {}

/**
 * Reads the body as UTF-8, stopping (and cancelling the stream) as soon as more than
 * `maxBytes` arrived, so an oversized or endless response never sits in memory whole.
 */
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) {
    const text = await res.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new TooLarge();
    return text;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new TooLarge();
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/** One GET with a deadline covering both the request and reading the body. */
async function get(url: string, accept: string, opts: LookupOptions): Promise<Fetched> {
  const fetchImpl = opts.fetch ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { accept, "user-agent": USER_AGENT },
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });
    const maxBytes = opts.maxBytes ?? MAX_RESPONSE_BYTES;
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) {
      await res.body?.cancel().catch(() => undefined);
      throw new TooLarge();
    }
    const text = await readCapped(res, maxBytes);
    return { ok: true, status: res.status, text };
  } catch (error) {
    if (timedOut) return { ok: false, code: "timeout" };
    if (error instanceof TooLarge) return { ok: false, code: "parse_error" };
    return { ok: false, code: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

function httpFailure(status: number): Extract<MetadataResult, { ok: false }> {
  // arXiv answers 400 for ids it cannot interpret; treat like an unknown id.
  if (status === 404 || status === 410 || status === 400)
    return { ok: false, code: "not_found", status };
  return { ok: false, code: "upstream_error", status };
}

async function lookupDoi(doi: string, opts: LookupOptions): Promise<MetadataResult> {
  const res = await get(crossrefUrl(doi), "application/json", opts);
  if (!res.ok) return res;
  if (res.status !== 200) return httpFailure(res.status);
  let body: unknown;
  try {
    body = JSON.parse(res.text);
  } catch {
    return { ok: false, code: "parse_error" };
  }
  const data = normalizeCrossref(body);
  if (!data) return { ok: false, code: "parse_error" };
  return { ok: true, source: "crossref", data: { ...data, doi: data.doi ?? doi } };
}

async function lookupArxiv(id: string, opts: LookupOptions): Promise<MetadataResult> {
  const res = await get(arxivUrl(id), "application/atom+xml", opts);
  if (!res.ok) return res;
  if (res.status !== 200) return httpFailure(res.status);
  const parsed = parseArxivAtom(res.text);
  if (!parsed.ok) return { ok: false, code: parsed.reason };
  return {
    ok: true,
    source: "arxiv",
    data: {
      ...parsed.data,
      url: parsed.data.url ?? `https://arxiv.org/abs/${stripArxivVersion(id)}`,
    },
  };
}

export function lookupIdentifier(
  id: Identifier,
  opts: LookupOptions = {},
): Promise<MetadataResult> {
  return id.kind === "doi" ? lookupDoi(id.doi, opts) : lookupArxiv(id.id, opts);
}

/**
 * Looks up title, authors, year (and venue/DOI/URL when known) for a pasted DOI or
 * arXiv link. Never throws: failures come back as `{ ok: false, code }`.
 */
export async function lookupMetadata(
  input: string,
  opts: LookupOptions = {},
): Promise<MetadataResult> {
  const id = typeof input === "string" ? parseIdentifier(input) : null;
  if (!id) return { ok: false, code: "invalid_input" };
  return lookupIdentifier(id, opts);
}
