import { describe, expect, it } from "vitest";
import { allowLocalZoomEvent } from "@/components/graph/model";

const ev = (type: string, mods: { ctrlKey?: boolean; metaKey?: boolean } = {}) => ({
  type,
  ctrlKey: !!mods.ctrlKey,
  metaKey: !!mods.metaKey,
});

describe("allowLocalZoomEvent", () => {
  it("always lets drag pan and touch pinch through", () => {
    for (const type of ["mousedown", "pointerdown", "touchstart", "touchmove", "dblclick"]) {
      expect(allowLocalZoomEvent(ev(type), false)).toBe(true);
    }
  });

  it("ignores a plain wheel until the graph is active, so the page keeps scrolling", () => {
    expect(allowLocalZoomEvent(ev("wheel"), false)).toBe(false);
    expect(allowLocalZoomEvent(ev("wheel"), true)).toBe(true);
  });

  it("still zooms with Ctrl/⌘ + wheel while inactive (trackpad pinch)", () => {
    expect(allowLocalZoomEvent(ev("wheel", { ctrlKey: true }), false)).toBe(true);
    expect(allowLocalZoomEvent(ev("wheel", { metaKey: true }), false)).toBe(true);
  });
});
