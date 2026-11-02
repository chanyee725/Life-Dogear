import { NextResponse } from "next/server";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export const forbidden = () => jsonError(403, "허용되지 않은 요청입니다.");

/** Unknown errors are logged by name only, never with request data. */
export function serverError(scope: string, error: unknown): NextResponse {
  console.error(`[api/graph${scope}]`, error instanceof Error ? error.name : "unknown error");
  return jsonError(500, "요청을 처리하지 못했습니다.");
}
