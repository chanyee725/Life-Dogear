import { describe, expect, it } from "vitest";
import { parseJumpParams, readerHref } from "@/lib/highlights";

describe("reader jump links", () => {
  it("builds ?page=&scroll= links", () => {
    expect(readerHref("seed-p1", 3)).toBe("/papers/seed-p1/read?page=3");
    expect(readerHref("seed-p1", 3, 0.25)).toBe("/papers/seed-p1/read?page=3&scroll=0.25");
  });

  it("parses valid params (also the search palette's ?page= links)", () => {
    expect(parseJumpParams({ page: "3" })).toEqual({ page: 3, scroll: 0 });
    expect(parseJumpParams({ page: "3", scroll: "0.25" })).toEqual({ page: 3, scroll: 0.25 });
    expect(parseJumpParams({ page: ["4", "5"], scroll: "1" })).toEqual({ page: 4, scroll: 1 });
  });

  it.each([
    {},
    { page: "" },
    { page: "0" },
    { page: "-1" },
    { page: "2.5" },
    { page: "abc" },
    { page: "1234567" },
  ])("ignores %j", (params) => {
    expect(parseJumpParams(params)).toBeNull();
  });

  it("ignores a bad scroll but keeps the page", () => {
    for (const scroll of ["2", "-0.1", "x", "0.5e1"]) {
      expect(parseJumpParams({ page: "2", scroll })).toEqual({ page: 2, scroll: 0 });
    }
  });
});
