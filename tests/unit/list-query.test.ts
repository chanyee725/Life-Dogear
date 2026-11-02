import { describe, expect, it } from "vitest";
import { buildHref } from "@/components/list/query";

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
