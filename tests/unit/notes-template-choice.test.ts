import { describe, expect, it } from "vitest";
import {
  canReplaceBody,
  chooseTemplate,
  initialChoice,
  nextIndex,
} from "@/app/notes/new/template-choice";

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

describe("chooseTemplate", () => {
  it("re-applies a template after own text was kept and then cleared (new editor key)", () => {
    const keys = new Set<number>();
    let s = initialChoice<string>("blank");
    keys.add(s.revision);
    s = chooseTemplate(s, "worklog", true); // A applied
    keys.add(s.revision);
    expect(s).toMatchObject({ selected: "worklog", applied: "worklog", skipped: false });
    s = chooseTemplate(s, "error", false); // own text written → B kept out
    expect(s).toMatchObject({ selected: "error", applied: "worklog", skipped: true });
    expect(keys.has(s.revision)).toBe(true); // editor not remounted
    s = chooseTemplate(s, "worklog", true); // body cleared → A again
    expect(s).toMatchObject({ selected: "worklog", applied: "worklog", skipped: false });
    expect(keys.has(s.revision)).toBe(false); // a fresh key remounts the editor with A
  });

  it("ignores picking the card that is already chosen", () => {
    const s = initialChoice("blank");
    expect(chooseTemplate(s, "blank", true)).toBe(s);
  });
});
