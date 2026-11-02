import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseArxivAtom } from "@/lib/metadata/arxiv";
import { crossrefUrl, normalizeCrossref } from "@/lib/metadata/crossref";
import { lookupMetadata, USER_AGENT } from "@/lib/metadata/lookup";
import { METADATA_ERROR_MESSAGES } from "@/lib/metadata/messages";
import type { FetchLike } from "@/lib/metadata/types";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", "metadata", name), "utf8");

const CROSSREF = fixture("crossref-work.json");
const ARXIV = fixture("arxiv-entry.xml");

/** Fake fetch answering every call with one fixed response; records calls. */
function respond(body: string, status = 200, headers: Record<string, string> = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(body, { status, headers });
  };
  return { fetch, calls };
}

/** Fake fetch that never answers until aborted, like a hung server. */
const hang: FetchLike = (_url, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("The operation was aborted.", "AbortError")),
    );
  });

describe("normalizeCrossref", () => {
  it("maps title, authors, year, venue, DOI and URL", () => {
    expect(normalizeCrossref(JSON.parse(CROSSREF))).toEqual({
      title: "Learning Sparse Representations & Their Limits",
      authors: ["Alex Sample", "Jordan Testwell", "Example Research Consortium"],
      year: 2021,
      venue: "Journal of Example Studies",
      doi: "10.1234/example.5678",
      url: "https://doi.org/10.1234/example.5678",
    });
  });

  it("falls back to other dates and tolerates missing fields", () => {
    expect(
      normalizeCrossref({
        message: { title: ["Only Title"], "published-online": { "date-parts": [[2019]] } },
      }),
    ).toEqual({ title: "Only Title", authors: [], year: 2019 });
  });

  it.each([
    null,
    "x",
    {},
    { message: [] },
    { message: { title: [] } },
    { message: { title: [""] } },
  ])("returns null for %j", (body) => {
    expect(normalizeCrossref(body)).toBeNull();
  });

  it("encodes DOI path segments", () => {
    expect(crossrefUrl("10.1002/(SICI)1097#x")).toBe(
      "https://api.crossref.org/works/10.1002/(SICI)1097%23x",
    );
  });
});

describe("parseArxivAtom", () => {
  it("maps an entry", () => {
    expect(parseArxivAtom(ARXIV)).toEqual({
      ok: true,
      data: {
        title: "A Toy Model of Attention & Memory",
        authors: ["Riley Placeholder", "Casey Fakename"],
        year: 2020,
        venue: "Proc. Example Conf. 2021",
        doi: "10.5555/toy.2021.001",
        url: "https://arxiv.org/abs/2101.00001",
      },
    });
  });

  it("handles old-style ids and CDATA", () => {
    expect(parseArxivAtom(fixture("arxiv-old.xml"))).toEqual({
      ok: true,
      data: {
        title: "Strings on a Toy Lattice",
        authors: ["Morgan Example"],
        year: 1999,
        url: "https://arxiv.org/abs/hep-th/9901001",
      },
    });
  });

  it("reports unknown ids and broken feeds", () => {
    expect(parseArxivAtom(fixture("arxiv-error.xml"))).toEqual({ ok: false, reason: "not_found" });
    expect(parseArxivAtom(fixture("arxiv-empty.xml"))).toEqual({ ok: false, reason: "not_found" });
    expect(parseArxivAtom("<html>oops</html>")).toEqual({ ok: false, reason: "parse_error" });
    expect(parseArxivAtom("<feed><entry><id>http://arxiv.org/abs/1</id></entry></feed>")).toEqual({
      ok: false,
      reason: "parse_error",
    });
  });
});

describe("lookupMetadata", () => {
  it("queries Crossref for a DOI with a polite User-Agent and no contact address", async () => {
    const { fetch, calls } = respond(CROSSREF);
    const result = await lookupMetadata("https://doi.org/10.1234/example.5678", { fetch });
    expect(result).toMatchObject({ ok: true, source: "crossref", data: { year: 2021 } });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.crossref.org/works/10.1234/example.5678");
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers["user-agent"]).toBe(USER_AGENT);
    expect(headers["user-agent"]).not.toMatch(/@|mailto/);
  });

  it("queries arXiv for arXiv links and arXiv DOIs", async () => {
    for (const input of ["https://arxiv.org/abs/2101.00001", "10.48550/arXiv.2101.00001"]) {
      const { fetch, calls } = respond(ARXIV);
      const result = await lookupMetadata(input, { fetch });
      expect(result).toMatchObject({
        ok: true,
        source: "arxiv",
        data: { title: "A Toy Model of Attention & Memory" },
      });
      expect(calls[0].url).toBe(
        "https://export.arxiv.org/api/query?id_list=2101.00001&max_results=1",
      );
    }
  });

  it("fills the DOI from the input when Crossref omits it", async () => {
    const { fetch } = respond(JSON.stringify({ message: { title: ["T"] } }));
    const result = await lookupMetadata("10.1000/abc", { fetch });
    expect(result).toEqual({
      ok: true,
      source: "crossref",
      data: { title: "T", authors: [], year: null, doi: "10.1000/abc" },
    });
  });

  it("rejects input that is not a DOI or arXiv id without calling out", async () => {
    const fetch = vi.fn<FetchLike>();
    expect(await lookupMetadata("hello", { fetch })).toEqual({ ok: false, code: "invalid_input" });
    expect(await lookupMetadata(42 as unknown as string, { fetch })).toEqual({
      ok: false,
      code: "invalid_input",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps 404 to not_found and 5xx/429 to upstream_error", async () => {
    expect(await lookupMetadata("10.1000/missing", respond("Resource not found.", 404))).toEqual({
      ok: false,
      code: "not_found",
      status: 404,
    });
    expect(await lookupMetadata("10.1000/x", respond("", 503))).toEqual({
      ok: false,
      code: "upstream_error",
      status: 503,
    });
    expect(await lookupMetadata("10.1000/x", respond("", 429))).toMatchObject({
      code: "upstream_error",
    });
    expect(await lookupMetadata("2101.00001", respond("bad id", 400))).toMatchObject({
      code: "not_found",
    });
  });

  it("maps an arXiv error entry to not_found", async () => {
    expect(await lookupMetadata("9999.99999", respond(fixture("arxiv-error.xml")))).toEqual({
      ok: false,
      code: "not_found",
    });
  });

  it("maps broken bodies to parse_error", async () => {
    expect(await lookupMetadata("10.1000/x", respond("{not json"))).toEqual({
      ok: false,
      code: "parse_error",
    });
    expect(await lookupMetadata("10.1000/x", respond('{"message":{}}'))).toEqual({
      ok: false,
      code: "parse_error",
    });
    expect(await lookupMetadata("2101.00001", respond("<html></html>"))).toEqual({
      ok: false,
      code: "parse_error",
    });
    expect(
      await lookupMetadata("10.1000/x", respond("{}", 200, { "content-length": "99999999" })),
    ).toEqual({ ok: false, code: "parse_error" });
  });

  it("maps a thrown fetch to network_error", async () => {
    const fetch: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await lookupMetadata("10.1000/x", { fetch })).toEqual({
      ok: false,
      code: "network_error",
    });
  });

  it("aborts after the time limit", async () => {
    const started = Date.now();
    expect(await lookupMetadata("10.1000/x", { fetch: hang, timeoutMs: 20 })).toEqual({
      ok: false,
      code: "timeout",
    });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("has a Korean message for every error code", () => {
    for (const message of Object.values(METADATA_ERROR_MESSAGES)) {
      expect(message).toMatch(/[가-힣]/);
    }
  });
});
