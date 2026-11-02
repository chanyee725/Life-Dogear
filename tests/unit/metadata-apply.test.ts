import { describe, expect, it } from "vitest";
import { fieldValue, fitToMaxLength, metadataToFields } from "@/components/metadata/apply";

describe("metadataToFields", () => {
  it("turns a record into form strings and drops empty fields", () => {
    expect(metadataToFields({ title: "T", authors: ["A B"], year: 2020, doi: "10.1/x" })).toEqual({
      title: "T",
      authors: ["A B"],
      year: "2020",
      doi: "10.1/x",
    });
    expect(metadataToFields({ title: "T", authors: [], year: null })).toEqual({
      title: "T",
      authors: [],
    });
  });
});

describe("field length limits", () => {
  it("cuts to maxLength without splitting surrogate pairs", () => {
    expect(fitToMaxLength("abcdef", 3)).toBe("abc");
    expect(fitToMaxLength("abc", 3)).toBe("abc");
    expect(fitToMaxLength("abc", -1)).toBe("abc");
    expect(fitToMaxLength("ab😀c", 3)).toBe("ab");
    expect(fitToMaxLength("ab😀c", 4)).toBe("ab😀");
    expect(fitToMaxLength("ab   cd", 4)).toBe("ab");
  });

  it("uses the input's maxLength, else the server limit", () => {
    const long = "가".repeat(400);
    expect(fieldValue("title", long, 300)).toHaveLength(300);
    expect(fieldValue("title", long)).toHaveLength(300);
    expect(fieldValue("title", long, 50)).toHaveLength(50);
    expect(fieldValue("venue", "v".repeat(3_000))).toHaveLength(2_000);
    expect(fieldValue("doi", "10.1/x")).toBe("10.1/x");
  });
});
