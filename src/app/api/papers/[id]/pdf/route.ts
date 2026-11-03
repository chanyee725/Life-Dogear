import { NextResponse, type NextRequest } from "next/server";
import { isValidItemId } from "@/lib/ids";
import { papers } from "@/lib/repo";
import { deletePdf, MAX_PDF_BYTES, openPdf, writePdf } from "@/lib/storage/pdf";
import { parseRangeHeader } from "@/lib/storage/range";
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

/** Multipart overhead allowed on top of the file itself. */
const FORM_OVERHEAD = 64 * 1024;

const BASE_HEADERS = {
  "Content-Type": "application/pdf",
  "Content-Disposition": "inline",
  "Accept-Ranges": "bytes",
  // The file can be replaced under the same URL.
  "Cache-Control": "private, no-cache",
  "X-Content-Type-Options": "nosniff",
  // Neutralises scripts if the file is ever opened directly as a document.
  "Content-Security-Policy": "sandbox",
};

/** Streams the paper's PDF, honouring single `Range` requests. */
export async function GET(request: NextRequest, { params }: IdParams) {
  const { id } = await params;
  if (!isValidItemId(id)) return invalidId();
  try {
    const paper = await papers.get(id);
    if (!paper?.pdfPath) return notFound();
    // One GET, ranged when asked (the bucket resolves suffix and open ranges itself);
    // headers come from what storage returned, so a replaced file cannot mismatch them.
    const file = await openPdf(id, parseRangeHeader(request.headers.get("range")) ?? undefined);
    if (!file) return jsonError(404, "PDF 파일을 찾을 수 없습니다.");
    if ("unsatisfiable" in file) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...BASE_HEADERS, "Content-Range": `bytes */${file.size}` },
      });
    }
    if (file.range) {
      const { start, end } = file.range;
      return new NextResponse(file.body, {
        status: 206,
        headers: {
          ...BASE_HEADERS,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${file.size}`,
        },
      });
    }
    return new NextResponse(file.body, {
      status: 200,
      headers: { ...BASE_HEADERS, ...(file.size ? { "Content-Length": String(file.size) } : {}) },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Uploads or replaces the PDF (multipart field `file`). */
export async function POST(request: NextRequest, { params }: IdParams) {
  if (!isSameOriginRequest(request.headers)) return forbidden();
  const { id } = await params;
  if (!isValidItemId(id)) return invalidId();

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_PDF_BYTES + FORM_OVERHEAD) return jsonError(413, "파일이 너무 큽니다.");

  try {
    if (!(await papers.get(id))) return notFound();

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError(400, "업로드 형식이 올바르지 않습니다.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(400, "PDF 파일을 선택하세요.");
    if (file.size > MAX_PDF_BYTES) return jsonError(413, "파일이 너무 큽니다.");

    const path = await writePdf(id, new Uint8Array(await file.arrayBuffer()));
    const result = await papers.setPdf(id, path);
    if (!result) {
      // The paper was deleted while uploading.
      await deletePdf(id);
      return notFound();
    }
    return NextResponse.json({ pdfPath: path }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Detaches and deletes the PDF. */
export async function DELETE(request: NextRequest, { params }: IdParams) {
  if (!isSameOriginRequest(request.headers)) return forbidden();
  const { id } = await params;
  if (!isValidItemId(id)) return invalidId();
  try {
    const result = await papers.setPdf(id, null);
    if (!result) return notFound();
    await deletePdf(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
