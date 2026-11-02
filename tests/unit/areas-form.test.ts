import { describe, expect, it } from "vitest";
import { parseAreaPatch } from "@/app/areas/form";

const form = (entries: [string, string][]) => {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
};

describe("parseAreaPatch", () => {
  it("reads sent fields and leaves the rest undefined", () => {
    expect(parseAreaPatch(form([["standard", "주 3회 운동"]]))).toEqual({
      title: undefined,
      standard: "주 3회 운동",
      body: undefined,
      tags: undefined,
    });
  });

  it("clears tags only with the presence marker", () => {
    expect(parseAreaPatch(form([["__present:tags", "1"]])).tags).toEqual([]);
    expect(parseAreaPatch(form([["tags", "건강"]])).tags).toEqual(["건강"]);
  });
});
