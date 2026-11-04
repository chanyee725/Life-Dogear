import { NextResponse, type NextRequest } from "next/server";
import { describeError } from "@/app/_actions/result";
import { papers } from "@/lib/repo";
import { parseSignInput, signUpload, UploadError } from "@/lib/storage/uploads";
import { isSameOriginRequest } from "../../papers/_lib/origin";
import { forbidden, jsonError, notFound } from "../../papers/_lib/responses";
import { directUploads, readJsonBody } from "../_lib/direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step 1 of a direct upload: `{ kind: "image" | "pdf", size, contentType, target? }` →
 * a 5-minute presigned PUT for `pending/<uuid>` (s3 mode), or `{ mode: "local" }` when
 * files are stored locally and the browser should use the regular upload routes.
 * The presigned URL is returned to the browser only, never logged.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return forbidden();
  try {
    const input = parseSignInput(await readJsonBody(request));
    const direct = directUploads();
    if (!direct) return NextResponse.json({ mode: "local" }, noStore());
    if (input.kind === "pdf" && !(await papers.get(input.target!))) return notFound();
    return NextResponse.json(await signUpload(direct.store, direct.tokenKey, input), noStore());
  } catch (error) {
    if (error instanceof UploadError) return jsonError(error.status, error.message);
    console.error("[api/uploads/sign]", describeError(error));
    return jsonError(500, "업로드를 준비하지 못했습니다.");
  }
}

const noStore = () => ({ headers: { "Cache-Control": "no-store" } });
