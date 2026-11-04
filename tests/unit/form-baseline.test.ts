import { describe, expect, it } from "vitest";
import { baselineFromRendered } from "@/components/fields/form-patch";

describe("baselineFromRendered", () => {
  it("keeps the read form as the baseline when nothing was typed before hydration", () => {
    const patch = { title: "논문", why: "", tags: ["a"] };
    const fields = [
      { name: "title", value: "논문", defaultValue: "논문" },
      { name: "why", value: "", defaultValue: "" },
    ];
    expect(baselineFromRendered(patch, fields)).toEqual({ baseline: patch, edited: false });
  });

  it("puts the rendered value back for fields typed into before hydration", () => {
    const patch = { title: "새 제목", why: "그대로" };
    const fields = [
      { name: "title", value: "새 제목", defaultValue: "옛 제목" },
      { name: "why", value: "그대로", defaultValue: "그대로" },
    ];
    expect(baselineFromRendered(patch, fields)).toEqual({
      baseline: { title: "옛 제목", why: "그대로" },
      edited: true,
    });
  });

  it("ignores unnamed fields and fields not in the patch (lists, files)", () => {
    const patch = { tags: ["a"] };
    const fields = [
      { name: "", value: "x", defaultValue: "" },
      { name: "tags", value: "draft", defaultValue: "" },
      { name: "other", value: "x", defaultValue: "" },
    ];
    expect(baselineFromRendered(patch, fields)).toEqual({ baseline: patch, edited: false });
  });
});
