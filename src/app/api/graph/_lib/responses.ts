import { NextResponse } from "next/server";
import { describeError } from "@/app/_actions/result";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export const forbidden = () => jsonError(403, "허용되지 않은 요청입니다.");

/** Unknown errors are logged by name/code only, never with request data. */
export function serverError(scope: string, error: unknown): NextResponse {
  console.error(`[api/graph${scope}]`, describeError(error));
  return jsonError(500, "요청을 처리하지 못했습니다.");
}
