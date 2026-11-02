import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/app/api/papers/_lib/origin";
import { MAX_LAYOUT_BODY, parseLayoutBody } from "@/lib/graph/query";
import { clearPositions, savePositions } from "@/lib/repo/graph-layout";
import { forbidden, jsonError, serverError } from "../_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `PUT /api/graph/layout` `{ positions: {node, x, y}[] }` → 204. Upserts; other positions stay. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request.headers)) return forbidden();
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_LAYOUT_BODY) return jsonError(413, "요청이 너무 큽니다.");

  const text = await request.text();
  if (text.length > MAX_LAYOUT_BODY) return jsonError(413, "요청이 너무 큽니다.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError(400, "위치 형식이 올바르지 않습니다.");
  }
  const positions = parseLayoutBody(body);
  if (!positions) return jsonError(400, "위치 형식이 올바르지 않습니다.");

  try {
    await savePositions(positions);
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
