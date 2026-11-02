import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/app/api/papers/_lib/origin";
import { searchAll } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE });

/**
 * `GET /api/search?q=…&limit=…` → `{ hits: SearchHit[] }` for the command palette.
 * Same-origin only: results contain private notes, so other sites must not trigger it.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request.headers)) {
    return json({ error: "허용되지 않은 요청입니다." }, 403);
  }
  const params = request.nextUrl.searchParams;
  try {
    const hits = await searchAll(params.get("q") ?? "", {
      limit: params.get("limit") ?? undefined,
    });
    return json({ hits });
  } catch (error) {
    // Log the error kind only: the query may contain personal notes.
    console.error("[api/search]", error instanceof Error ? error.name : "unknown error");
    return json({ error: "검색하지 못했습니다." }, 500);
  }
}
