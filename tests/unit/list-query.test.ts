import { describe, expect, it } from "vitest";
import { buildHref, countTags, filterByTag, firstParam } from "@/components/list/query";

describe("buildHref", () => {
  it("sets a param and keeps the others", () => {
    expect(buildHref("/papers", { status: "reading" }, { tag: "NLP" })).toBe(
      "/papers?status=reading&tag=NLP",
    );
  });

  it("removes a param when patched with undefined or empty", () => {
    expect(buildHref("/papers", { tag: "NLP", status: "done" }, { tag: undefined })).toBe(
      "/papers?status=done",
    );
    expect(buildHref("/papers", { tag: "NLP" }, { tag: "" })).toBe("/papers");
  });

  it("encodes values and uses the first of repeated params", () => {
    expect(buildHref("/thoughts", { kind: ["idea", "memo"] }, { tag: "강화 학습" })).toBe(
      "/thoughts?kind=idea&tag=%EA%B0%95%ED%99%94+%ED%95%99%EC%8A%B5",
    );
  });
});

describe("list helpers", () => {
  it("firstParam returns the first non-empty value", () => {
    expect(firstParam({ a: ["x", "y"], b: "", c: undefined }, "a")).toBe("x");
    expect(firstParam({ b: "" }, "b")).toBeUndefined();
  });

  it("countTags merges case-insensitively and sorts in Korean collation (Hangul first)", () => {
    expect(countTags([{ tags: ["NLP", "비전"] }, { tags: ["nlp"] }])).toEqual([
      { name: "비전", count: 1 },
      { name: "NLP", count: 2 },
    ]);
  });

  it("filterByTag matches case-insensitively", () => {
    const items = [
      { id: 1, tags: ["NLP"] },
      { id: 2, tags: [] },
    ];
    expect(filterByTag(items, "nlp").map((i) => i.id)).toEqual([1]);
    expect(filterByTag(items, undefined)).toHaveLength(2);
  });
});
