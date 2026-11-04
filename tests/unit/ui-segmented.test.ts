import { describe, expect, it } from "vitest";
import { segmentedNextIndex } from "@/components/ui/segmented-style";

describe("segmentedNextIndex", () => {
  it("moves with ←/→ and wraps", () => {
    expect(segmentedNextIndex(0, 3, "ArrowRight")).toBe(1);
    expect(segmentedNextIndex(2, 3, "ArrowRight")).toBe(0);
    expect(segmentedNextIndex(0, 3, "ArrowLeft")).toBe(2);
  });

  it("treats ↑ like ← and ↓ like →", () => {
    expect(segmentedNextIndex(1, 3, "ArrowUp")).toBe(0);
    expect(segmentedNextIndex(0, 3, "ArrowUp")).toBe(2);
    expect(segmentedNextIndex(1, 3, "ArrowDown")).toBe(2);
    expect(segmentedNextIndex(2, 3, "ArrowDown")).toBe(0);
  });

  it("with nothing checked, ← goes to the last option and → to the first", () => {
    expect(segmentedNextIndex(-1, 3, "ArrowLeft")).toBe(2);
    expect(segmentedNextIndex(-1, 3, "ArrowUp")).toBe(2);
    expect(segmentedNextIndex(-1, 3, "ArrowRight")).toBe(0);
    expect(segmentedNextIndex(-1, 3, "ArrowDown")).toBe(0);
  });

  it("ignores other keys and empty groups", () => {
    expect(segmentedNextIndex(0, 3, "Enter")).toBeNull();
    expect(segmentedNextIndex(0, 3, "Tab")).toBeNull();
    expect(segmentedNextIndex(-1, 0, "ArrowRight")).toBeNull();
  });
});
