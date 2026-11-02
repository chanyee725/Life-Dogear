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

  it("resolves only the listed wasm decoders", () => {
    expect(resolvePdfjsAsset([version, "wasm", "openjpeg.wasm"], version)?.contentType).toBe(
      "application/wasm",
    );
    expect(
      resolvePdfjsAsset([version, "wasm", "jbig2_nowasm_fallback.js"], version)?.contentType,
    ).toBe("text/javascript");
    expect(resolvePdfjsAsset([version, "wasm", "qcms_bg.wasm"], version)).not.toBeNull();
    expect(resolvePdfjsAsset([version, "wasm", "quickjs-eval.wasm"], version)).toBeNull();
    expect(resolvePdfjsAsset([version, "wasm", "quickjs-eval.js"], version)).toBeNull();
    expect(resolvePdfjsAsset([version, "wasm", "LICENSE_JBIG2"], version)).toBeNull();
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

  it("serves wasm decoders as application/wasm", async () => {
    const res = await fetchAsset([version, "wasm", "openjpeg.wasm"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/wasm");
  });

  it("returns 404 for anything else", async () => {
    expect((await fetchAsset([version, "cmaps", "Nope.bcmap"])).status).toBe(404);
    expect((await fetchAsset([version, "..", "package.json"])).status).toBe(404);
  });
});
