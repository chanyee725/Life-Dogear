import { describe, expect, it } from "vitest";
import { metadataToFields } from "@/components/metadata/apply";

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
