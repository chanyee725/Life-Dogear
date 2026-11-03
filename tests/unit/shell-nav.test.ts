import { describe, expect, it } from "vitest";
import { isActivePath, LIBRARY_HREF, NAV_SECTIONS } from "@/components/shell/nav";

describe("sidebar 자료 section", () => {
  it("links the section title to the topic-first resources page", () => {
    expect(LIBRARY_HREF).toBe("/resources");
    expect(isActivePath("/resources", LIBRARY_HREF)).toBe(true);
    expect(isActivePath("/papers", LIBRARY_HREF)).toBe(false);
  });

  it("keeps the per-kind menus", () => {
    expect(NAV_SECTIONS.library.map((e) => e.href)).toEqual([
      "/papers",
      "/seminars",
      "/thoughts",
      "/tags",
      "/graph",
    ]);
  });
});
