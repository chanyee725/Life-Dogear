import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/app/api/papers/_lib/origin";
import { ITEM_TYPE } from "@/lib/enums";
import { parseNodeRef } from "@/lib/graph/query";
import { RepoError } from "@/lib/repo";
import { setStarred } from "@/lib/repo/stars";
import { forbidden, jsonError, serverError } from "../_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 1_000;

/** Body of `PUT /api/graph/stars`. */
export type StarBody = { node: string; starred: boolean };

/**
 * `PUT /api/graph/stars` `{ node: "<type>:<id>", starred }` → 204. Stars or unstars an
 * item ("중요" in the cosmos view). Same-origin only; topics cannot be starred.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request.headers)) return forbidden();
  const text = await request.text();
  if (text.length > MAX_BODY) return jsonError(413, "요청이 너무 큽니다.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError(400, "형식이 올바르지 않습니다.");
  }
  const { node, starred } = (body ?? {}) as Partial<StarBody>;
  const ref = parseNodeRef(node);
  if (!ref || !ITEM_TYPE.is(ref.type) || typeof starred !== "boolean") {
    return jsonError(400, "형식이 올바르지 않습니다.");
  }
  try {
    await setStarred({ type: ref.type, id: ref.id }, starred);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof RepoError && error.code === "not_found") {
      return jsonError(404, "항목을 찾을 수 없습니다.");
    }
    return serverError("/stars", error);
  }
}
