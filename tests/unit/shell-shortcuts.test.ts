import { describe, expect, it } from "vitest";
import { isTypingTarget, resolveShortcut } from "@/components/shell/shortcuts";

const key = (
  k: string,
  mods: Partial<{
    code: string;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    isComposing: boolean;
    keyCode: number;
  }> = {},
) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...mods,
});

describe("resolveShortcut", () => {
  it("N opens the new form of the current section", () => {
    expect(resolveShortcut(key("n"), "/papers", { typing: false })).toEqual({
      kind: "navigate",
      href: "/papers/new",
    });
    expect(resolveShortcut(key("N"), "/projects/abc", { typing: false })).toEqual({
      kind: "navigate",
      href: "/projects/new",
    });
  });

  it("N falls back to a new thought outside item sections", () => {
    expect(resolveShortcut(key("n"), "/", { typing: false })).toEqual({
      kind: "navigate",
      href: "/thoughts/new",
    });
    expect(resolveShortcut(key("n"), "/tags", { typing: false })).toEqual({
      kind: "navigate",
      href: "/thoughts/new",
    });
  });

  it("N opens a new area on area pages and a new thought in the inbox and archive", () => {
    expect(resolveShortcut(key("n"), "/areas/abc", { typing: false })).toEqual({
      kind: "navigate",
      href: "/areas/new",
    });
    expect(resolveShortcut(key("n"), "/inbox", { typing: false })).toEqual({
      kind: "navigate",
      href: "/thoughts/new",
    });
    expect(resolveShortcut(key("n"), "/archive", { typing: false })).toEqual({
      kind: "navigate",
      href: "/thoughts/new",
    });
  });

  it("N does nothing when already on the new form", () => {
    expect(resolveShortcut(key("n"), "/seminars/new", { typing: false })).toBeNull();
  });

  it("/ focuses the quick input", () => {
    expect(resolveShortcut(key("/"), "/papers", { typing: false })).toEqual({
      kind: "focus-quick-input",
    });
  });

  it("accepts the physical key in a Korean input mode", () => {
    expect(resolveShortcut(key("ㅜ", { code: "KeyN" }), "/papers", { typing: false })).toEqual({
      kind: "navigate",
      href: "/papers/new",
    });
    expect(resolveShortcut(key("/", { code: "Slash" }), "/", { typing: false })).toEqual({
      kind: "focus-quick-input",
    });
    expect(
      resolveShortcut(key("?", { code: "Slash", shiftKey: true }), "/", { typing: false }),
    ).toBeNull();
  });

  it("ignores shortcuts while a dialog is open", () => {
    expect(resolveShortcut(key("n"), "/papers", { typing: false, dialogOpen: true })).toBeNull();
  });

  it("ignores typing, IME composition and modifier keys", () => {
    expect(
      resolveShortcut(key("Process", { code: "KeyN", keyCode: 229 }), "/", { typing: false }),
    ).toBeNull();
    expect(resolveShortcut(key("n"), "/", { typing: true })).toBeNull();
    expect(resolveShortcut(key("n", { isComposing: true }), "/", { typing: false })).toBeNull();
    expect(resolveShortcut(key("n", { metaKey: true }), "/", { typing: false })).toBeNull();
    expect(resolveShortcut(key("/", { ctrlKey: true }), "/", { typing: false })).toBeNull();
    expect(resolveShortcut(key("k"), "/", { typing: false })).toBeNull();
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
