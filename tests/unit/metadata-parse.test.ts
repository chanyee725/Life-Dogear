import { describe, expect, it } from "vitest";
import { parseIdentifier } from "@/lib/metadata/parse";
import { cleanText, decodeEntities, toYear } from "@/lib/metadata/text";

describe("parseIdentifier", () => {
  it.each([
    ["10.1145/3292500.3330701", "10.1145/3292500.3330701"],
    ["  doi:10.1000/xyz123  ", "10.1000/xyz123"],
    ["DOI: 10.1000/xyz123", "10.1000/xyz123"],
    ["https://doi.org/10.1000/xyz123", "10.1000/xyz123"],
    ["http://dx.doi.org/10.1000/xyz123", "10.1000/xyz123"],
    ["https://doi.org/10.1002/(SICI)1097-4571%28199806%2949", "10.1002/(SICI)1097-4571(199806)49"],
    ["10.1000/xyz123.", "10.1000/xyz123"],
  ])("DOI %s", (input, doi) => {
    expect(parseIdentifier(input)).toEqual({ kind: "doi", doi });
  });

  it.each([
    ["2101.00001", "2101.00001"],
    ["arXiv:2101.00001", "2101.00001"],
    ["arxiv: 2101.00001v3", "2101.00001v3"],
    ["https://arxiv.org/abs/2101.00001", "2101.00001"],
    ["https://arxiv.org/abs/2101.00001v2", "2101.00001v2"],
    ["https://arxiv.org/pdf/2101.00001", "2101.00001"],
    ["https://arxiv.org/pdf/2101.00001v1.pdf", "2101.00001v1"],
    ["http://export.arxiv.org/abs/1501.0001", "1501.0001"],
    ["https://www.arxiv.org/abs/2101.00001/", "2101.00001"],
    ["hep-th/9901001", "hep-th/9901001"],
    ["arXiv:math.GT/0309136", "math.GT/0309136"],
    ["https://arxiv.org/abs/hep-th/9901001v1", "hep-th/9901001v1"],
    ["10.48550/arXiv.2101.00001", "2101.00001"],
    ["https://doi.org/10.48550/ARXIV.2101.00001", "2101.00001"],
  ])("arXiv %s", (input, id) => {
    expect(parseIdentifier(input)).toEqual({ kind: "arxiv", id });
  });

  it.each([
    "",
    "   ",
    "hello world",
    "11.1000/xyz",
    "10.12/short-registrant",
    "https://example.com/10.1000/xyz",
    "https://arxiv.org/list/cs.LG/recent",
    "ftp://doi.org/10.1000/xyz",
    "javascript:alert(1)",
    "arXiv:not-an-id",
    "https://doi.org/%E0%A4%A",
    "10.1000/" + "x".repeat(600),
  ])("rejects %j", (input) => {
    expect(parseIdentifier(input)).toBeNull();
  });
});

describe("text helpers", () => {
  it("decodes entities and strips markup", () => {
    expect(decodeEntities("A &amp; B &#233; &#x00E9; &bogus;")).toBe("A & B é é &bogus;");
    expect(cleanText("  <i>Deep</i>\n  learning <sub>2</sub> ")).toBe("Deep learning 2");
  });

  it("accepts only plausible years", () => {
    expect(toYear(2021)).toBe(2021);
    expect(toYear("1999")).toBe(1999);
    expect(toYear("20a1")).toBeNull();
    expect(toYear(99)).toBeNull();
    expect(toYear(undefined)).toBeNull();
  });
});
