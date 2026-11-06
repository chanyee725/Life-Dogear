import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_FLAP_PATH, BRAND_PAGE_PATH, BRAND_VIEWBOX } from "@/components/brand-mark";

describe("brand mark", () => {
  const favicon = readFileSync(join(process.cwd(), "src/app/icon.svg"), "utf8");

  it("favicon uses the same sheet and flap geometry as the sidebar mark", () => {
    expect(favicon).toContain(`viewBox="${BRAND_VIEWBOX}"`);
    expect(favicon).toContain(`d="${BRAND_PAGE_PATH}"`);
    expect(favicon).toContain(`d="${BRAND_FLAP_PATH}"`);
  });

  it("favicon follows light and dark color schemes", () => {
    expect(favicon).toContain("currentColor");
    expect(favicon).toContain("prefers-color-scheme: dark");
  });
});
