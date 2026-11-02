import { describe, expect, it } from "vitest";
import { addTags, normalizeTag } from "@/components/fields/tags";

describe("normalizeTag", () => {
  it("trims, drops leading # and collapses spaces", () => {
    expect(normalizeTag("  #강화  학습 ")).toBe("강화 학습");
    expect(normalizeTag("##")).toBe("");
  });
});

describe("addTags", () => {
  it("adds comma separated tags and skips empties", () => {
    expect(addTags([], "NLP, , #방법론")).toEqual(["NLP", "방법론"]);
  });

  it("ignores case-insensitive duplicates, including within the input", () => {
    expect(addTags(["NLP"], "nlp, Vision, vision")).toEqual(["NLP", "Vision"]);
  });

  it("does not mutate the input", () => {
    const current = ["a"];
    addTags(current, "b");
    expect(current).toEqual(["a"]);
  });
});
