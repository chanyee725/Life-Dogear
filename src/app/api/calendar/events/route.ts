import { NextResponse, type NextRequest } from "next/server";
import { describeError } from "@/app/_actions/result";
import { isSameOriginRequest } from "@/app/api/papers/_lib/origin";
import {
  GoogleWriteError,
  insertEvent,
  parseNewEvent,
  type GoogleWriteErrorCode,
} from "@/lib/calendar/google-write";
import { settingsEnv } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const MAX_BODY = 4096;

const STATUS: Record<GoogleWriteErrorCode | "forbidden" | "too_large" | "server", number> = {
  forbidden: 403,
  too_large: 413,
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
  if (declared > MAX_BODY) return fail("too_large");
  const text = await readCapped(request, MAX_BODY);
  if (text === null) return fail("too_large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail("invalid");
  }
  const input = parseNewEvent(body);
  if (!input) return fail("invalid");
  try {
    // The calendar id may be saved in /settings (wins over GOOGLE_CALENDAR_ID).
    const item = await insertEvent(input, { env: await settingsEnv() });
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

/** Body as text, or null once it passes `max` bytes (stops reading there). */
async function readCapped(request: NextRequest, max: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
