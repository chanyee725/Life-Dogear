import type { NextRequest } from "next/server";
import { S3BlobStore, s3ConfigFromEnv } from "@/lib/storage/blob";
import { uploadTokenKey } from "@/lib/storage/upload-token";
import { UploadError } from "@/lib/storage/uploads";

/** The bucket and the upload-token key in s3 mode; null when files are stored locally. */
export function directUploads(): { store: S3BlobStore; tokenKey: Buffer } | null {
  const config = s3ConfigFromEnv();
  if (!config) return null;
  return { store: new S3BlobStore(config), tokenKey: uploadTokenKey(config.secretAccessKey) };
}

/** Sign and confirm bodies are a few hundred bytes of JSON. */
const MAX_BODY = 2048;

export async function readJsonBody(request: NextRequest): Promise<unknown> {
  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY) throw new UploadError(400, "업로드 요청이 올바르지 않습니다.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new UploadError(400, "업로드 요청이 올바르지 않습니다.");
  }
}
