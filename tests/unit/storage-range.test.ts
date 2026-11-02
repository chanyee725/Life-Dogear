import { describe, expect, it } from "vitest";
import { parseRange } from "@/lib/storage/range";

describe("parseRange", () => {
  const size = 1000;

  it("returns null without a usable header", () => {
    expect(parseRange(null, size)).toBeNull();
    expect(parseRange("", size)).toBeNull();
    expect(parseRange("bytes=-", size)).toBeNull();
    expect(parseRange("items=0-10", size)).toBeNull();
    expect(parseRange("bytes=0-10,20-30", size)).toBeNull();
    expect(parseRange("bytes=10-5", size)).toBeNull();
  });

  it("parses closed, open and suffix ranges", () => {
    expect(parseRange("bytes=0-99", size)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=900-", size)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=900-5000", size)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=-100", size)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=-5000", size)).toEqual({ start: 0, end: 999 });
  });

  it("flags ranges outside the file", () => {
    expect(parseRange("bytes=1000-", size)).toBe("unsatisfiable");
    expect(parseRange("bytes=-0", size)).toBe("unsatisfiable");
    expect(parseRange("bytes=0-", 0)).toBe("unsatisfiable");
  });
});
