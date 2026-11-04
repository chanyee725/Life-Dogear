import { NextResponse, type NextRequest } from "next/server";
import { describeError } from "@/app/_actions/result";
import { isSameOriginRequest } from "@/app/api/papers/_lib/origin";
import { getCalendar, MAX_RANGE_DAYS, parseRange } from "@/lib/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const error = (status: number, message: string) =>
  NextResponse.json({ error: message }, { status, headers: NO_STORE });

/**
 * `GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&papers=1` → `CalendarResult`.
 * Read-only and same-origin only (private titles, Google events). Behind the sign-in
 * middleware like every route.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request.headers)) return error(403, "허용되지 않은 요청입니다.");
  const params = request.nextUrl.searchParams;
  const range = parseRange({ from: params.get("from"), to: params.get("to") });
  if (!range) return error(400, `날짜 범위가 올바르지 않습니다(최대 ${MAX_RANGE_DAYS}일).`);
  try {
    const result = await getCalendar(range, { papers: params.get("papers") === "1" });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (e) {
    console.error("[api/calendar]", describeError(e));
    return error(500, "요청을 처리하지 못했습니다.");
  }
}
