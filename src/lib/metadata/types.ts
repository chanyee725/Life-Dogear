/** Bibliographic fields filled from a DOI or arXiv link. */
export type PaperMetadata = {
  title: string;
  authors: string[];
  year: number | null;
  venue?: string;
  doi?: string;
  url?: string;
};

/** A recognised identifier. arXiv ids keep their version suffix (`v2`) if given. */
export type Identifier = { kind: "doi"; doi: string } | { kind: "arxiv"; id: string };

export type MetadataErrorCode =
  /** The input is not a DOI or arXiv id/link. */
  | "invalid_input"
  /** The registry has no record for the identifier. */
  | "not_found"
  /** The registry answered with an unexpected HTTP status (5xx, 429, …). */
  | "upstream_error"
  /** The response could not be read as a record (broken JSON/XML, missing title). */
  | "parse_error"
  /** No answer within the time limit. */
  | "timeout"
  /** The request never got an answer (DNS, connection refused, offline). */
  | "network_error";

export type MetadataResult =
  | { ok: true; data: PaperMetadata; source: "crossref" | "arxiv" }
  | { ok: false; code: MetadataErrorCode; status?: number };

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
