import { NextResponse, type NextRequest } from "next/server";
import { describeError } from "@/app/_actions/result";
import { isSameOriginRequest } from "@/app/api/papers/_lib/origin";
import { resolveAuthMode } from "@/lib/auth/mode";
import { RepoError } from "@/lib/repo/shared";
import { saveSetting, settingsView } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const MAX_BODY = 32 * 1024;
const error = (status: number, message: string) =>
  NextResponse.json({ error: message }, { status, headers: NO_STORE });

const viewFor = (request: NextRequest) =>
  settingsView(resolveAuthMode(process.env, request.headers.get("host")).kind);

/**
 * `GET /api/settings` → `{ view: SettingsView }` (masked on the server; no secret, no email).
 * Same-origin only; sign-in is enforced by the middleware like every route.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request.headers)) return error(403, "허용되지 않은 요청입니다.");
  try {
    return NextResponse.json({ view: await viewFor(request) }, { headers: NO_STORE });
  } catch (e) {
    console.error("[api/settings]", describeError(e));
    return error(500, "요청을 처리하지 못했습니다.");
  }
}

/**
 * `PUT /api/settings` `{ key, value }` → `{ view }`. An empty `value` removes the app value
 * (back to the env). Only `EDITABLE_KEYS`; anything else is 400. The value is never logged
 * or echoed back.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request.headers)) return error(403, "허용되지 않은 요청입니다.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) {
    return error(413, "값이 너무 깁니다.");
  }
  const text = await request.text();
  if (text.length > MAX_BODY) return error(413, "값이 너무 깁니다.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return error(400, "요청이 올바르지 않습니다.");
  }
  const { key, value } = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  try {
    await saveSetting(key, value);
    return NextResponse.json({ view: await viewFor(request) }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof RepoError) return error(400, e.message);
    console.error("[api/settings]", describeError(e));
    return error(500, "요청을 처리하지 못했습니다.");
  }
}
