import { describe, expect, it } from "vitest";
import { isTypingTarget, resolveShortcut } from "@/components/shell/shortcuts";

const key = (
  k: string,
  mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; isComposing: boolean }> = {},
) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...mods,
});

describe("resolveShortcut", () => {
  it("N opens the new form of the current section", () => {
    expect(resolveShortcut(key("n"), "/papers", false)).toEqual({
      kind: "navigate",
      href: "/papers/new",
    });
    expect(resolveShortcut(key("N"), "/projects/abc", false)).toEqual({
      kind: "navigate",
      href: "/projects/new",
    });
  });

  it("N falls back to a new thought outside item sections", () => {
    expect(resolveShortcut(key("n"), "/", false)).toEqual({
      kind: "navigate",
      href: "/thoughts/new",
    });
    expect(resolveShortcut(key("n"), "/tags", false)).toEqual({
      kind: "navigate",
      href: "/thoughts/new",
    });
  });

  it("N does nothing when already on the new form", () => {
    expect(resolveShortcut(key("n"), "/seminars/new", false)).toBeNull();
  });

  it("/ focuses the quick input", () => {
    expect(resolveShortcut(key("/"), "/papers", false)).toEqual({ kind: "focus-quick-input" });
  });

  it("ignores typing, IME composition and modifier keys", () => {
    expect(resolveShortcut(key("n"), "/", true)).toBeNull();
    expect(resolveShortcut(key("n", { isComposing: true }), "/", false)).toBeNull();
    expect(resolveShortcut(key("n", { metaKey: true }), "/", false)).toBeNull();
    expect(resolveShortcut(key("/", { ctrlKey: true }), "/", false)).toBeNull();
    expect(resolveShortcut(key("k"), "/", false)).toBeNull();
  });
});

describe("isTypingTarget", () => {
  const el = (tagName: string, extra: Record<string, unknown> = {}) =>
    ({ tagName, isContentEditable: false, ...extra }) as unknown as EventTarget;

  it("detects text fields and editors", () => {
    expect(isTypingTarget(el("INPUT", { type: "text" }))).toBe(true);
    expect(isTypingTarget(el("TEXTAREA"))).toBe(true);
    expect(isTypingTarget(el("SELECT"))).toBe(true);
    expect(isTypingTarget(el("DIV", { isContentEditable: true }))).toBe(true);
  });

  it("ignores non-text targets", () => {
    expect(isTypingTarget(el("INPUT", { type: "checkbox" }))).toBe(false);
    expect(isTypingTarget(el("BUTTON"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
