import { NextResponse } from "next/server";
import { RepoError } from "@/lib/repo";
import { PdfStorageError } from "@/lib/storage/pdf";

export type IdParams = { params: Promise<{ id: string }> };

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export const notFound = () => jsonError(404, "논문을 찾을 수 없습니다.");
export const invalidId = () => jsonError(400, "잘못된 논문 id입니다.");
export const forbidden = () => jsonError(403, "허용되지 않은 요청입니다.");

const STORAGE_STATUS: Record<PdfStorageError["code"], number> = {
  invalid_id: 400,
  empty: 400,
  not_pdf: 415,
  too_large: 413,
};

/** Maps known errors to responses; unknown errors are logged without request data. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof PdfStorageError) return jsonError(STORAGE_STATUS[error.code], error.message);
  if (error instanceof RepoError) {
    return jsonError(error.code === "not_found" ? 404 : 400, error.message);
  }
  console.error("[api/papers]", error instanceof Error ? error.name : "unknown error");
  return jsonError(500, "요청을 처리하지 못했습니다.");
}
