import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/app/api/papers/_lib/origin";
import { existingNodeIds } from "@/lib/graph/load";
import { MAX_LAYOUT_BODY, parseLayoutBody } from "@/lib/graph/query";
import { clearPositions, savePositions } from "@/lib/repo/graph-layout";
import { forbidden, jsonError, serverError } from "../_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `PUT /api/graph/layout` `{ positions: {node, x, y}[] }` → 204. Upserts existing nodes; others stay. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request.headers)) return forbidden();
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_LAYOUT_BODY) return jsonError(413, "요청이 너무 큽니다.");

  // Bytes, not UTF-16 length: content-length may be absent or wrong.
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_LAYOUT_BODY) return jsonError(413, "요청이 너무 큽니다.");
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return jsonError(400, "위치 형식이 올바르지 않습니다.");
  }
  const positions = parseLayoutBody(body);
  if (!positions) return jsonError(400, "위치 형식이 올바르지 않습니다.");

  try {
    // Positions of items that do not exist (deleted, never existed) are dropped.
    const existing = await existingNodeIds(positions.map((p) => p.node));
    await savePositions(positions.filter((p) => existing.has(p.node)));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serverError("/layout", error);
  }
}

/** `DELETE /api/graph/layout` → 204. Clears every saved position (초기화). */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request.headers)) return forbidden();
  try {
    await clearPositions();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serverError("/layout", error);
  }
}
