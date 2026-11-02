import { describe, expect, it } from "vitest";
import { isInAppNavigation } from "@/components/fields/unsaved-guard";

const current = new URL("http://127.0.0.1:3000/projects/abc?x=1");
const click = (mods: Partial<Parameters<typeof isInAppNavigation>[0]> = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  ...mods,
});
const anchor = (href: string, extra: Partial<Parameters<typeof isInAppNavigation>[1]> = {}) => ({
  href,
  target: "",
  hasDownload: false,
  ...extra,
});

describe("isInAppNavigation", () => {
  it("guards plain clicks to other pages of the app", () => {
    expect(isInAppNavigation(click(), anchor("/projects"), current)).toBe(true);
    expect(isInAppNavigation(click(), anchor("http://127.0.0.1:3000/"), current)).toBe(true);
    expect(isInAppNavigation(click(), anchor("/projects/abc?x=2"), current)).toBe(true);
    expect(isInAppNavigation(click(), anchor("/papers", { target: "_self" }), current)).toBe(true);
  });

  it("ignores modified clicks, other buttons and already handled clicks", () => {
    for (const mod of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
      expect(isInAppNavigation(click({ [mod]: true }), anchor("/papers"), current)).toBe(false);
    }
    expect(isInAppNavigation(click({ button: 1 }), anchor("/papers"), current)).toBe(false);
    expect(isInAppNavigation(click({ defaultPrevented: true }), anchor("/papers"), current)).toBe(
      false,
    );
  });

  it("ignores new tabs, downloads, other origins and same-page hash links", () => {
    expect(isInAppNavigation(click(), anchor("/papers", { target: "_blank" }), current)).toBe(
      false,
    );
    expect(
      isInAppNavigation(click(), anchor("/api/papers/1/pdf", { hasDownload: true }), current),
    ).toBe(false);
    expect(isInAppNavigation(click(), anchor("https://example.com/"), current)).toBe(false);
    expect(isInAppNavigation(click(), anchor("/projects/abc?x=1#links"), current)).toBe(false);
  });
});
