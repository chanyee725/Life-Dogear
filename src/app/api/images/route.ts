import { NextResponse, type NextRequest } from "next/server";
import {
  IMAGE_URL_PREFIX,
  ImageStorageError,
  MAX_IMAGE_BYTES,
  writeImage,
} from "@/lib/storage/images";
import { isSameOriginRequest } from "../papers/_lib/origin";
import { forbidden, jsonError } from "../papers/_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Multipart overhead allowed on top of the file itself. */
const FORM_OVERHEAD = 64 * 1024;

const STATUS: Record<ImageStorageError["code"], number> = {
  empty: 400,
  too_large: 413,
  not_image: 415,
  heic: 415,
};

/** Stores one photo (multipart field `file`) and returns its URL for the editor. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return forbidden();
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES + FORM_OVERHEAD) {
    return jsonError(413, "사진이 너무 큽니다 (최대 20MB).");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "업로드 형식이 올바르지 않습니다.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "사진 파일을 선택하세요.");
  if (file.size > MAX_IMAGE_BYTES) return jsonError(413, "사진이 너무 큽니다 (최대 20MB).");
  try {
    const name = await writeImage(new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ url: `${IMAGE_URL_PREFIX}${name}` }, { status: 201 });
  } catch (error) {
    if (error instanceof ImageStorageError) return jsonError(STATUS[error.code], error.message);
    console.error("[api/images]", error instanceof Error ? error.name : "unknown error");
    return jsonError(500, "사진을 저장하지 못했습니다.");
  }
}
