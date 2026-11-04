import { NextResponse, type NextRequest } from "next/server";
import { describeError } from "@/app/_actions/result";
import { isSameOriginRequest } from "@/app/api/papers/_lib/origin";
import {
  GoogleWriteError,
  insertEvent,
  parseNewEvent,
  type GoogleWriteErrorCode,
} from "@/lib/calendar/google-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const MAX_BODY = 4096;

const STATUS: Record<GoogleWriteErrorCode | "forbidden" | "server", number> = {
  forbidden: 403,
  invalid: 400,
  not_configured: 503,
  auth: 502,
  network: 502,
  server: 500,
};
const fail = (code: keyof typeof STATUS) =>
  NextResponse.json({ error: code }, { status: STATUS[code], headers: NO_STORE });

/**
 * `POST /api/calendar/events` `{ title, date: YYYY-MM-DD, start?: HH:mm, end?: HH:mm }` →
 * 201 `{ item }` (a `CalendarItem`, source `google`), or `{ error: code }`. Same-origin only;
 * sign-in is enforced by the middleware like every route.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request.headers)) return fail("forbidden");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) return fail("invalid");
  const text = await request.text();
  if (text.length > MAX_BODY) return fail("invalid");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail("invalid");
  }
  const input = parseNewEvent(body);
  if (!input) return fail("invalid");
  try {
    const item = await insertEvent(input);
    return NextResponse.json({ item }, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (e instanceof GoogleWriteError) {
      if (e.code !== "invalid") console.warn("[api/calendar/events]", describeError(e));
      return fail(e.code);
    }
    console.error("[api/calendar/events]", describeError(e));
    return fail("server");
  }
}
