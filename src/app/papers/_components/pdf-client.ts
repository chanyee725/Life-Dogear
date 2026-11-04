/** Browser-side calls to the paper PDF API. Errors come back as Korean messages. */
import { directUpload } from "@/lib/storage/direct-upload";

/** Same limit as the server (`MAX_PDF_BYTES`), checked early to skip a doomed upload. */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

async function errorFrom(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : fallback;
}

/**
 * Uploads or replaces the PDF. Returns an error message, or null on success.
 * s3 mode: straight to the bucket (sign → PUT → confirm); local mode: multipart POST.
 */
export async function uploadPaperPdf(paperId: string, file: File): Promise<string | null> {
  const looksLikePdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!looksLikePdf) return "PDF 파일만 올릴 수 있습니다.";
  if (file.size > MAX_UPLOAD_BYTES) return "100MB 이하의 PDF만 올릴 수 있습니다.";
  try {
    const direct = await directUpload(
      { kind: "pdf", file, contentType: "application/pdf", target: paperId },
      "PDF를 올리지 못했습니다.",
    );
    if (direct.mode === "s3") return null;
  } catch (error) {
    return error instanceof Error ? error.message : "PDF를 올리지 못했습니다.";
  }
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`/api/papers/${paperId}/pdf`, { method: "POST", body: form });
    return res.ok ? null : await errorFrom(res, "PDF를 올리지 못했습니다.");
  } catch {
    return "PDF를 올리지 못했습니다. 연결을 확인해 주세요.";
  }
}

/** Detaches and deletes the PDF. Returns an error message, or null on success. */
export async function removePaperPdf(paperId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/papers/${paperId}/pdf`, { method: "DELETE" });
    return res.ok ? null : await errorFrom(res, "PDF를 제거하지 못했습니다.");
  } catch {
    return "PDF를 제거하지 못했습니다. 연결을 확인해 주세요.";
  }
}
