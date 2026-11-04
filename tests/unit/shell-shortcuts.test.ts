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

  it("N on the notes list or a note opens a new note", () => {
    expect(resolveShortcut(key("n"), "/notes", { typing: false })).toEqual({
      kind: "navigate",
      href: "/notes/new",
    });
    expect(resolveShortcut(key("n"), "/notes/abc", { typing: false })).toEqual({
      kind: "navigate",
      href: "/notes/new",
    });
    expect(resolveShortcut(key("n"), "/notes/new", { typing: false })).toBeNull();
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

  it("G opens the graph, and does nothing on the graph itself", () => {
    expect(resolveShortcut(key("g"), "/papers/abc", { typing: false })).toEqual({
      kind: "navigate",
      href: "/graph",
    });
    expect(resolveShortcut(key("G"), "/", { typing: false })).toEqual({
      kind: "navigate",
      href: "/graph",
    });
    expect(resolveShortcut(key("g"), "/graph", { typing: false })).toBeNull();
  });

  it("G works in a Korean input mode and is ignored while typing or with modifiers", () => {
    expect(resolveShortcut(key("ㅎ", { code: "KeyG" }), "/", { typing: false })).toEqual({
      kind: "navigate",
      href: "/graph",
    });
    expect(resolveShortcut(key("g"), "/", { typing: true })).toBeNull();
    expect(resolveShortcut(key("g", { ctrlKey: true }), "/", { typing: false })).toBeNull();
    expect(resolveShortcut(key("g", { isComposing: true }), "/", { typing: false })).toBeNull();
    expect(resolveShortcut(key("g"), "/", { typing: false, dialogOpen: true })).toBeNull();
  });

  it("/ focuses the node search on the graph page", () => {
    expect(resolveShortcut(key("/"), "/graph", { typing: false })).toEqual({
      kind: "focus-graph-search",
    });
    expect(resolveShortcut(key("/"), "/graphs", { typing: false })).toEqual({
      kind: "focus-quick-input",
    });
  });

  it("N on the graph page still opens a new thought", () => {
    expect(resolveShortcut(key("n"), "/graph", { typing: false })).toEqual({
      kind: "navigate",
      href: "/thoughts/new",
    });
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

describe("C — quick capture", () => {
  const open = { kind: "open-capture" };
  it("opens capture anywhere, also in Korean input mode", () => {
    expect(resolveShortcut(key("c"), "/", { typing: false })).toEqual(open);
    expect(resolveShortcut(key("C"), "/graph", { typing: false })).toEqual(open);
    expect(resolveShortcut(key("ㅊ", { code: "KeyC" }), "/papers", { typing: false })).toEqual(
      open,
    );
  });

  it("is ignored while typing, in a dialog, composing or with ⌘/Ctrl/Alt (copy stays copy)", () => {
    expect(resolveShortcut(key("c"), "/", { typing: true })).toBeNull();
    expect(resolveShortcut(key("c"), "/", { typing: false, dialogOpen: true })).toBeNull();
    expect(resolveShortcut(key("c", { isComposing: true }), "/", { typing: false })).toBeNull();
    expect(resolveShortcut(key("c", { keyCode: 229 }), "/", { typing: false })).toBeNull();
    expect(resolveShortcut(key("c", { ctrlKey: true }), "/", { typing: false })).toBeNull();
    expect(resolveShortcut(key("c", { metaKey: true }), "/", { typing: false })).toBeNull();
    expect(resolveShortcut(key("c", { altKey: true }), "/", { typing: false })).toBeNull();
  });
});
