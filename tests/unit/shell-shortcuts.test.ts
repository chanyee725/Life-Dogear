// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { Shortcuts } from "@/components/shell/Shortcuts";
import {
  isTypingTarget,
  OPEN_MODAL_SELECTOR,
  QUICK_ADD_EVENT,
  resolveShortcut,
} from "@/components/shell/shortcuts";

const nav = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => nav.pathname,
}));

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

describe("Shortcuts `/` on the home", () => {
  it("sends QUICK_ADD_EVENT and never pushes `/` again when nothing handles it yet", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    nav.pathname = "/";
    nav.push.mockClear();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(Shortcuts)));
    const sent = vi.fn();
    window.addEventListener(QUICK_ADD_EVENT, sent);
    try {
      // No 빠른 추가 listener yet (hard load still hydrating): the event goes unhandled.
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", code: "Slash" }));
      });
      expect(sent).toHaveBeenCalledTimes(1);
      expect(nav.push).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(QUICK_ADD_EVENT, sent);
      act(() => root.unmount());
      host.remove();
    }
  });
});

describe("Shortcuts while a Radix dialog is open", () => {
  it.each(["dialog-content", "alert-dialog-content"])(
    "ignores one-key shortcuts when [data-slot=%s] is in the DOM",
    (slot) => {
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      nav.pathname = "/papers";
      nav.push.mockClear();
      const host = document.createElement("div");
      document.body.append(host);
      const modal = document.createElement("div");
      modal.setAttribute("role", "dialog");
      modal.dataset.slot = slot;
      document.body.append(modal);
      const root = createRoot(host);
      act(() => root.render(createElement(Shortcuts)));
      try {
        act(() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "g", code: "KeyG" }));
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", code: "KeyN" }));
        });
        expect(nav.push).not.toHaveBeenCalled();
        modal.remove();
        act(() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "g", code: "KeyG" }));
        });
        expect(nav.push).toHaveBeenCalledWith("/graph");
      } finally {
        modal.remove();
        act(() => root.unmount());
        host.remove();
      }
    },
  );
});

describe("Radix Select and menus count as typing / open", () => {
  const html = (markup: string) => {
    const host = document.createElement("div");
    host.innerHTML = markup;
    return host;
  };

  it("treats a Select trigger, its options and menu items as typing targets", () => {
    const host = html(`
      <button role="combobox" id="t">영역</button>
      <div role="listbox"><div role="option" id="o"><span id="os">연구</span></div></div>
      <div role="menu"><div role="menuitem" id="m">삭제</div></div>
      <button id="b">⋯</button>`);
    for (const id of ["t", "o", "os", "m"]) {
      expect(isTypingTarget(host.querySelector(`#${id}`))).toBe(true);
    }
    expect(isTypingTarget(host.querySelector("#b"))).toBe(false);
  });

  it("matches open select lists and dropdown menus as modal", () => {
    for (const slot of ["select-content", "dropdown-menu-content"]) {
      expect(
        html(`<div data-slot="${slot}"></div>`).querySelector(OPEN_MODAL_SELECTOR),
      ).not.toBeNull();
    }
    expect(
      html(`<div data-slot="popover-content"></div>`).querySelector(OPEN_MODAL_SELECTOR),
    ).toBeNull();
  });

  it("Korean-mode keys (ㅜ/ㅊ/ㅎ) on a menu item do nothing", () => {
    const item = html(`<div role="menu"><div role="menuitem">삭제</div></div>`).querySelector(
      "[role=menuitem]",
    );
    for (const [k, code] of [
      ["ㅜ", "KeyN"],
      ["ㅊ", "KeyC"],
      ["ㅎ", "KeyG"],
    ] as const) {
      const typing = isTypingTarget(item);
      expect(resolveShortcut(key(k, { code }), "/", { typing })).toBeNull();
    }
  });
});
