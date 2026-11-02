import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { pdfjsRoot, pdfjsVersion, resolvePdfjsAsset } from "@/app/api/pdfjs/_lib/assets";
import { GET } from "@/app/api/pdfjs/[...path]/route";

const version = pdfjsVersion();

const fetchAsset = (path: string[]) =>
  GET(new NextRequest(`http://localhost:3000/api/pdfjs/${path.join("/")}`), {
    params: Promise.resolve({ path }),
  });

describe("resolvePdfjsAsset", () => {
  it("resolves allowed files", () => {
    expect(resolvePdfjsAsset([version, "cmaps", "UniKS-UCS2-H.bcmap"], version)).toEqual({
      path: `${pdfjsRoot()}/cmaps/UniKS-UCS2-H.bcmap`,
      contentType: "application/octet-stream",
    });
    expect(
      resolvePdfjsAsset([version, "standard_fonts", "LiberationSans-Regular.ttf"], version)
        ?.contentType,
    ).toBe("font/ttf");
  });

  it.each([
    [["0.0.0", "cmaps", "UniKS-UCS2-H.bcmap"]],
    [[version, "build", "pdf.mjs"]],
    [[version, "cmaps", "LICENSE"]],
    [[version, "standard_fonts", "LICENSE_FOXIT"]],
    [[version, "cmaps", "../package.json"]],
    [[version, "cmaps", "..%2Fpackage.json"]],
    [[version, "cmaps", ".bcmap"]],
    [[version, "cmaps", "a.ttf"]],
    [[version, "__proto__", "x.bcmap"]],
    [[version, "cmaps", "x.toString"]],
    [[version, "cmaps"]],
    [[version, "cmaps", "sub", "x.bcmap"]],
  ])("rejects %j", (segments) => {
    expect(resolvePdfjsAsset(segments, version)).toBeNull();
  });
});

describe("GET /api/pdfjs/[...path]", () => {
  it("serves a cMap with long-lived caching", async () => {
    const res = await fetchAsset([version, "cmaps", "UniKS-UCS2-H.bcmap"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("returns 404 for anything else", async () => {
    expect((await fetchAsset([version, "cmaps", "Nope.bcmap"])).status).toBe(404);
    expect((await fetchAsset([version, "..", "package.json"])).status).toBe(404);
  });
});
