import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isApplePlatform, modKeyFor, useModKey } from "@/components/shell/mod-key";

describe("mod key label", () => {
  it("is ⌘ on Apple platforms", () => {
    for (const p of ["MacIntel", "iPhone", "iPad", "Macintosh; Intel Mac OS X"]) {
      expect(isApplePlatform(p)).toBe(true);
      expect(modKeyFor(p)).toBe("⌘");
    }
  });

  it("is Ctrl on Linux and Windows", () => {
    for (const p of ["Linux x86_64", "Win32", "X11; Linux x86_64", ""]) {
      expect(modKeyFor(p)).toBe("Ctrl");
    }
  });

  it("renders Ctrl on the server so hydration starts from a known value", () => {
    function Label() {
      return createElement("span", null, useModKey());
    }
    expect(renderToString(createElement(Label))).toBe("<span>Ctrl</span>");
  });
});
