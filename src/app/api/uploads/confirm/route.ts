import { NextResponse, type NextRequest } from "next/server";
import { describeError } from "@/app/_actions/result";
import { papers } from "@/lib/repo";
import { deletePdf, pdfRelativePath } from "@/lib/storage/pdf";
import { finalizeUpload, parseConfirmInput, UploadError } from "@/lib/storage/uploads";
import { isSameOriginRequest } from "../../papers/_lib/origin";
import { forbidden, jsonError, notFound } from "../../papers/_lib/responses";
import { directUploads, readJsonBody } from "../_lib/direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// An in-bucket copy of a large PDF can take a few seconds; stay clear of short defaults.
export const maxDuration = 60;

/**
 * Step 3 of a direct upload: `{ kind, key: "pending/<uuid>", target? }`. Checks the uploaded
 * bytes, moves them to the final key and records them: photos answer `{ url }`, PDFs are
 * attached to the paper and answer `{ pdfPath }`. The temporary object is always deleted.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return forbidden();
  try {
    const direct = directUploads();
    if (!direct) return jsonError(409, "이 저장소에서는 직접 업로드를 쓰지 않습니다.");
    const { store, tokenKey } = direct;
    const input = parseConfirmInput(await readJsonBody(request), tokenKey);
    if (input.kind === "pdf" && !(await papers.get(input.target!))) {
      await store.delete(input.key).catch(() => false);
      return notFound();
    }
    const done = await finalizeUpload(store, input);
    if (done.kind === "image") return NextResponse.json({ url: done.url }, { status: 201 });

    const id = input.target!;
    const path = pdfRelativePath(id);
    if (!(await papers.setPdf(id, path))) {
      // The paper was deleted meanwhile.
      await deletePdf(id);
      return notFound();
    }
    return NextResponse.json({ pdfPath: path }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) return jsonError(error.status, error.message);
    console.error("[api/uploads/confirm]", describeError(error));
    return jsonError(500, "업로드를 마치지 못했습니다.");
  }
}
