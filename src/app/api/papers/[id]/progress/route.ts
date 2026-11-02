import { NextResponse, type NextRequest } from "next/server";
import { papers } from "@/lib/repo";
import { isValidItemId } from "@/lib/ids";
import { MAX_PROGRESS_BODY, parseProgressInput } from "../../_lib/progress-input";
import { isSameOriginRequest } from "../../_lib/origin";
import {
  errorResponse,
  forbidden,
  invalidId,
  jsonError,
  notFound,
  type IdParams,
} from "../../_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saves the reading position `{ page, scroll, totalPages? }`. POST exists for
 * `navigator.sendBeacon`, which always POSTs (usually as text/plain).
 */
async function save(request: NextRequest, { params }: IdParams): Promise<NextResponse> {
  if (!isSameOriginRequest(request.headers)) return forbidden();
  const { id } = await params;
  if (!isValidItemId(id)) return invalidId();

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_PROGRESS_BODY) return jsonError(413, "요청이 너무 큽니다.");
  const input = parseProgressInput(await request.text());
  if (!input) return jsonError(400, "읽기 위치 형식이 올바르지 않습니다.");

  try {
    // Reading positions only make sense for a paper with a PDF.
    const paper = await papers.get(id);
    if (!paper?.pdfPath) return notFound();
    const saved = await papers.saveProgress(id, input);
    return saved ? new NextResponse(null, { status: 204 }) : notFound();
  } catch (error) {
    return errorResponse(error);
  }
}

export const PUT = save;
export const POST = save;
