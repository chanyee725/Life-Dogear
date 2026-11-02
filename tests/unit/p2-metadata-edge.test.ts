import { describe, expect, it } from "vitest";
import { normalizeCrossref, crossrefUrl } from "@/lib/metadata/crossref";
import { lookupMetadata } from "@/lib/metadata/lookup";
import { MAX_INPUT_LENGTH, parseIdentifier } from "@/lib/metadata/parse";
import type { FetchLike } from "@/lib/metadata/types";

const doiOf = (input: string) => {
  const r = parseIdentifier(input);
  return r && r.kind === "doi" ? r.doi : r;
};
const arxivOf = (input: string) => {
  const r = parseIdentifier(input);
  return r && r.kind === "arxiv" ? r.id : r;
};

describe("parseIdentifier: DOI as people paste it", () => {
  it.each([
    ["  10.1000/abc  ", "10.1000/abc"],
    ["\n10.1000/abc\n", "10.1000/abc"],
    ["https://doi.org/10.1000/abc", "10.1000/abc"],
    ["http://dx.doi.org/10.1000/abc", "10.1000/abc"],
    ["https://www.doi.org/10.1000/abc", "10.1000/abc"],
    ["HTTPS://DOI.ORG/10.1000/abc", "10.1000/abc"],
    ["doi:10.1000/abc", "10.1000/abc"],
    ["DOI: 10.1000/abc", "10.1000/abc"],
    ["https://doi.org/10.1000/abc?utm_source=x", "10.1000/abc"],
    ["https://doi.org/10.1000/abc.", "10.1000/abc"],
    ["10.1000/abc.", "10.1000/abc"],
    ["10.1000/abc,", "10.1000/abc"],
  ])("%j -> %s", (input, doi) => {
    expect(doiOf(input)).toBe(doi);
  });

  it("keeps the case of the suffix or lower-cases it, but never loses the DOI", () => {
    const got = doiOf("https://doi.org/10.1000/ABC");
    expect(typeof got).toBe("string");
    expect((got as string).toLowerCase()).toBe("10.1000/abc");
  });

  it("decodes URL-encoded DOIs", () => {
    expect(doiOf("https://doi.org/10.1000%2Fabc%28x%29")).toBe("10.1000/abc(x)");
    expect(doiOf("https://doi.org/10.1000/abc%23frag")).toBe("10.1000/abc#frag");
  });

  it("keeps parentheses and angle brackets inside a DOI", () => {
    const sici = "10.1002/(SICI)1097-4571(199806)49:8<693::AID-ASI4>3.0.CO;2-O";
    expect(doiOf(sici)).toBe(sici);
    expect(doiOf(`https://doi.org/${sici}`)).toBe(sici);
    expect(doiOf(`https://doi.org/${encodeURIComponent(sici)}`)).toBe(sici);
  });

  it("keeps a closing parenthesis at the end of a DOI", () => {
    expect(doiOf("10.1016/0021-9991(90)90001-X")).toBe("10.1016/0021-9991(90)90001-X");
    expect(doiOf("10.1000/abc(1)")).toBe("10.1000/abc(1)");
  });

  it("routes arXiv-registered DOIs to arXiv", () => {
    expect(parseIdentifier("10.48550/arXiv.2101.00001")).toEqual({
      kind: "arxiv",
      id: "2101.00001",
    });
    expect(parseIdentifier("https://doi.org/10.48550/arxiv.2101.00001v2")).toEqual({
      kind: "arxiv",
      id: "2101.00001v2",
    });
  });
});

describe("parseIdentifier: arXiv as people paste it", () => {
  it.each([
    ["https://arxiv.org/abs/2101.00001v3", "2101.00001v3"],
    ["https://arxiv.org/abs/2101.00001", "2101.00001"],
    ["https://arxiv.org/abs/2101.00001/", "2101.00001"],
    ["https://arxiv.org/abs/2101.00001?context=cs", "2101.00001"],
    ["https://arxiv.org/pdf/2101.00001.pdf", "2101.00001"],
    ["https://arxiv.org/pdf/2101.00001v3.pdf", "2101.00001v3"],
    ["https://arxiv.org/pdf/2101.00001v3", "2101.00001v3"],
    ["https://www.arxiv.org/abs/2101.00001", "2101.00001"],
    ["http://export.arxiv.org/abs/2101.00001", "2101.00001"],
    ["https://arxiv.org/html/2101.00001v1", "2101.00001v1"],
    ["arXiv:2101.00001", "2101.00001"],
    ["ARXIV: 2101.00001v3", "2101.00001v3"],
    ["2101.00001", "2101.00001"],
    ["0704.0001", "0704.0001"],
    ["  2101.00001v3  ", "2101.00001v3"],
  ])("%j -> %s", (input, id) => {
    expect(arxivOf(input)).toBe(id);
  });

  it.each([
    ["math.GT/0309136", "math.GT/0309136"],
    ["arXiv:math.GT/0309136", "math.GT/0309136"],
    ["hep-th/9901001", "hep-th/9901001"],
    ["https://arxiv.org/abs/math/0309136", "math/0309136"],
    ["https://arxiv.org/abs/math.GT/0309136v2", "math.GT/0309136v2"],
    ["https://arxiv.org/pdf/math.GT/0309136.pdf", "math.GT/0309136"],
    ["https://arxiv.org/abs/hep-th%2F9901001", "hep-th/9901001"],
  ])("old-style %j -> %s", (input, id) => {
    expect(arxivOf(input)).toBe(id);
  });
});

describe("parseIdentifier: invalid input", () => {
  const long = (n: number) => "10.1000/" + "a".repeat(n - 8);

  it.each([
    "",
    "   ",
    "\n\t",
    "hello",
    "논문 제목입니다",
    "10.1000",
    "10.1000/",
    "10.12/abc",
    "10.1000/abc def",
    "10.1000/abc\n10.1000/def",
    "doi:",
    "arxiv:",
    "arxiv:not-an-id",
    "2101.1",
    "2101.123456",
    "ftp://doi.org/10.1000/abc",
    "javascript:alert(1)",
    "https://example.com/10.1000/abc",
    "https://doi.org/",
    "https://doi.org/not-a-doi",
    "https://doi.org/%E0%A4%A",
    "https://arxiv.org/",
    "https://arxiv.org/a/someone",
    "https://arxiv.org/abs/not-an-id",
    "https://arxiv.org/abs/%E0%A4%A",
    "https://",
  ])("returns null for %j", (input) => {
    expect(parseIdentifier(input)).toBeNull();
  });

  it("enforces the length limit exactly", () => {
    expect(parseIdentifier(long(MAX_INPUT_LENGTH))).not.toBeNull();
    expect(parseIdentifier(long(MAX_INPUT_LENGTH + 1))).toBeNull();
    expect(parseIdentifier(`  ${long(MAX_INPUT_LENGTH)}  `)).not.toBeNull(); // limit applies after trim
  });
});

describe("normalizeCrossref: sparse and odd records", () => {
  const work = (message: Record<string, unknown>) => ({ message });

  it("returns null without a usable title", () => {
    expect(normalizeCrossref(work({}))).toBeNull();
    expect(normalizeCrossref(work({ title: [] }))).toBeNull();
    expect(normalizeCrossref(work({ title: ["   "] }))).toBeNull();
    expect(normalizeCrossref(work({ title: [null, 5] }))).toBeNull();
    expect(normalizeCrossref(work({ title: "<i></i>" }))).toBeNull();
  });

  it("accepts a plain string title and skips empty entries in a title array", () => {
    expect(normalizeCrossref(work({ title: "Plain" }))?.title).toBe("Plain");
    expect(normalizeCrossref(work({ title: ["", "Second"] }))?.title).toBe("Second");
  });

  it("returns empty authors when missing or malformed", () => {
    expect(normalizeCrossref(work({ title: ["T"] }))?.authors).toEqual([]);
    expect(normalizeCrossref(work({ title: ["T"], author: [] }))?.authors).toEqual([]);
    expect(normalizeCrossref(work({ title: ["T"], author: "Ada" }))?.authors).toEqual([]);
    expect(
      normalizeCrossref(work({ title: ["T"], author: [{}, null, 3, { given: " " }] }))?.authors,
    ).toEqual([]);
  });

  it("handles family-only, given-only and organisation authors", () => {
    expect(
      normalizeCrossref(
        work({
          title: ["T"],
          author: [{ family: "Fakeperson" }, { given: "Solo" }, { name: "Test Org" }],
        }),
      )?.authors,
    ).toEqual(["Fakeperson", "Solo", "Test Org"]);
  });

  it("takes the year from published-print alone", () => {
    expect(
      normalizeCrossref(work({ title: ["T"], "published-print": { "date-parts": [[2018, 3]] } }))
        ?.year,
    ).toBe(2018);
  });

  it("skips Crossref's null date-parts and falls through to the next date", () => {
    expect(
      normalizeCrossref(
        work({
          title: ["T"],
          issued: { "date-parts": [[null]] },
          "published-print": { "date-parts": [[2017]] },
        }),
      )?.year,
    ).toBe(2017);
  });

  it("returns null year when no date is usable", () => {
    for (const dates of [
      {},
      { issued: { "date-parts": [] } },
      { issued: { "date-parts": [[]] } },
      { issued: { "date-parts": [[0]] } },
      { issued: { "date-parts": [[99999]] } },
      { issued: { "date-parts": [[2021.5]] } },
      { issued: "2021" },
    ]) {
      expect(normalizeCrossref(work({ title: ["T"], ...dates }))?.year).toBeNull();
    }
  });

  it("accepts a year given as a string", () => {
    expect(
      normalizeCrossref(work({ title: ["T"], issued: { "date-parts": [["2020"]] } }))?.year,
    ).toBe(2020);
  });

  it("decodes entities and strips markup in titles", () => {
    expect(
      normalizeCrossref(work({ title: ["Caf&#233; &lt;b&gt; &amp; <sub>x</sub>"] }))?.title,
    ).toBe("Café <b> & x");
  });

  it("omits venue, doi and url when absent", () => {
    expect(normalizeCrossref(work({ title: ["T"] }))).toEqual({
      title: "T",
      authors: [],
      year: null,
    });
  });

  it("falls back to the event name for venue", () => {
    expect(
      normalizeCrossref(work({ title: ["T"], event: { name: "Fake Conf 2020" } }))?.venue,
    ).toBe("Fake Conf 2020");
  });

  it("does not throw on non-object bodies", () => {
    for (const body of [undefined, null, 1, "x", [], { message: null }, { message: "x" }]) {
      expect(normalizeCrossref(body)).toBeNull();
    }
  });
});

describe("lookupMetadata with pasted forms (fixed responses, no network)", () => {
  function fake(body: string, status = 200) {
    const urls: string[] = [];
    const fetch: FetchLike = async (url) => {
      urls.push(url);
      return new Response(body, { status });
    };
    return { fetch, urls };
  }

  it("requests the cleaned DOI from Crossref", async () => {
    const { fetch, urls } = fake(JSON.stringify({ message: { title: ["T"] } }));
    const r = await lookupMetadata("  doi:10.1000/abc.  ", { fetch });
    expect(r.ok).toBe(true);
    expect(urls).toEqual([crossrefUrl("10.1000/abc")]);
  });

  it("falls back to the requested DOI when the record omits it", async () => {
    const { fetch } = fake(JSON.stringify({ message: { title: ["T"] } }));
    const r = await lookupMetadata("https://doi.org/10.1000/abc", { fetch });
    expect(r.ok && r.data.doi).toBe("10.1000/abc");
  });

  it("does not call the network for invalid input", async () => {
    const { fetch, urls } = fake("{}");
    for (const input of ["", "hello", "x".repeat(MAX_INPUT_LENGTH + 1)]) {
      expect(await lookupMetadata(input, { fetch })).toEqual({ ok: false, code: "invalid_input" });
    }
    expect(urls).toEqual([]);
  });

  it("maps a Crossref record without title to parse_error, not a crash", async () => {
    const { fetch } = fake(JSON.stringify({ message: { author: [{ family: "Fakeperson" }] } }));
    expect(await lookupMetadata("10.1000/abc", { fetch })).toEqual({
      ok: false,
      code: "parse_error",
    });
  });
});
