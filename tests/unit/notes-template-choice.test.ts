import { describe, expect, it } from "vitest";
import { canReplaceBody, nextIndex } from "@/app/notes/new/template-choice";

describe("canReplaceBody", () => {
  it("replaces an empty or whitespace-only body", () => {
    expect(canReplaceBody("", null)).toBe(true);
    expect(canReplaceBody("  \n", "## 증상")).toBe(true);
  });

  it("replaces a body that is still the template as loaded", () => {
    expect(canReplaceBody("## 증상\n\n## 원인", "## 증상\n\n## 원인")).toBe(true);
  });

  it("keeps anything the user wrote", () => {
    expect(canReplaceBody("## 증상\n\n빌드가 멈춤\n\n## 원인", "## 증상\n\n## 원인")).toBe(false);
    expect(canReplaceBody("메모", null)).toBe(false);
  });
});

describe("nextIndex", () => {
  it("moves with arrows and wraps", () => {
    expect(nextIndex("ArrowRight", 0, 5)).toBe(1);
    expect(nextIndex("ArrowDown", 4, 5)).toBe(0);
    expect(nextIndex("ArrowLeft", 0, 5)).toBe(4);
    expect(nextIndex("ArrowUp", 2, 5)).toBe(1);
    expect(nextIndex("Home", 3, 5)).toBe(0);
    expect(nextIndex("End", 0, 5)).toBe(4);
    expect(nextIndex("Enter", 1, 5)).toBeNull();
  });
});
