import { readFile, stat } from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { pdfjsVersion, resolvePdfjsAsset } from "../_lib/assets";

export const runtime = "nodejs";

/**
 * Serves pdf.js cMaps, standard fonts and wasm image decoders from
 * node_modules/pdfjs-dist so Korean/CJK PDFs without embedded fonts and scanned
 * PDFs render, without a CDN or copying files into public/.
 * URL: /api/pdfjs/<version>/<cmaps|standard_fonts|wasm>/<file>.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const asset = resolvePdfjsAsset(path, pdfjsVersion());
  if (!asset) return new NextResponse(null, { status: 404 });
  try {
    const info = await stat(asset.path);
    if (!info.isFile()) return new NextResponse(null, { status: 404 });
    const body = await readFile(asset.path);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": asset.contentType,
        "Content-Length": String(body.length),
        // The URL contains the pdfjs version, so the content never changes.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
