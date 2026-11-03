import { describe, expect, it } from "vitest";
import { hiddenFilterCount } from "@/components/graph/GraphFilterBar";

describe("compact graph filter bar", () => {
  it("counts only the conditions behind the 필터 button", () => {
    expect(hiddenFilterCount({})).toBe(0);
    // Type chips and 완료 포함 stay in the row, so they are not counted.
    expect(hiddenFilterCount({ types: ["goal"], doneTasks: true })).toBe(0);
    expect(hiddenFilterCount({ area: "a", tag: "t", archived: true, orphans: true })).toBe(4);
  });
});
