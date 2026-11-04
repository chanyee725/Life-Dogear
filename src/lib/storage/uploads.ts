import { isValidItemId } from "@/lib/ids";
import {
  isPendingKey,
  newPendingKey,
  PRESIGN_TTL_SECONDS,
  type BlobStore,
  type S3BlobStore,
} from "./blob";
import { IMAGE_TYPES, IMAGE_URL_PREFIX, imageKey, MAX_IMAGE_BYTES, sniffImage } from "./images";
import { isPdfBytes, MAX_PDF_BYTES, pdfKey } from "./pdf";

/**
 * Direct browser uploads to the bucket (s3 mode), for files larger than a Vercel function
 * accepts:
 * 1. `POST /api/uploads/sign` checks kind, type and size and returns a presigned PUT for a
 *    temporary key `pending/<uuid>` (5 minutes; type and byte count are signed).
 * 2. The browser PUTs the file to the bucket.
 * 3. `POST /api/uploads/confirm` reads the first bytes back (ranged GET), checks the magic
 *    bytes and size, copies the object to its final key and deletes the temporary one.
 *    Anything that fails is deleted; leftovers are removed by `storage:gc-images`.
 */

export type UploadKind = "image" | "pdf";

export class UploadError extends Error {
  constructor(
    readonly status: 400 | 404 | 413 | 415,
    message: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export type SignInput = { kind: UploadKind; size: number; contentType: string; target?: string };

const SIGNABLE_IMAGE_TYPES: ReadonlySet<string> = new Set(Object.values(IMAGE_TYPES));
const HEIC_MESSAGE = "HEIC 사진은 브라우저에서 보이지 않습니다. JPG로 바꿔서 올려 주세요.";
const NOT_IMAGE_MESSAGE = "JPG·PNG·GIF·WebP 사진만 올릴 수 있습니다.";
const IMAGE_TOO_LARGE = "사진이 너무 큽니다 (최대 20MB).";
const PDF_TOO_LARGE = "파일이 너무 큽니다.";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Validates a sign request body; throws {@link UploadError}. */
export function parseSignInput(body: unknown): SignInput {
  if (!isObject(body)) throw new UploadError(400, "업로드 요청이 올바르지 않습니다.");
  const { kind, size, contentType, target } = body;
  if (kind !== "image" && kind !== "pdf") {
    throw new UploadError(400, "업로드 요청이 올바르지 않습니다.");
  }
  if (typeof size !== "number" || !Number.isInteger(size) || size < 0) {
    throw new UploadError(400, "업로드 요청이 올바르지 않습니다.");
  }
  if (size === 0) throw new UploadError(400, "빈 파일입니다.");
  const type = typeof contentType === "string" ? contentType.trim().toLowerCase() : "";
  if (kind === "image") {
    if (/^image\/hei[cf](-sequence)?$/.test(type)) throw new UploadError(415, HEIC_MESSAGE);
    if (!SIGNABLE_IMAGE_TYPES.has(type)) throw new UploadError(415, NOT_IMAGE_MESSAGE);
    if (size > MAX_IMAGE_BYTES) throw new UploadError(413, IMAGE_TOO_LARGE);
    return { kind, size, contentType: type };
  }
  if (type !== "application/pdf") throw new UploadError(415, "PDF 파일이 아닙니다.");
  if (size > MAX_PDF_BYTES) throw new UploadError(413, PDF_TOO_LARGE);
  if (typeof target !== "string" || !isValidItemId(target)) {
    throw new UploadError(400, "잘못된 논문 id입니다.");
  }
  return { kind, size, contentType: type, target };
}

export type SignedUpload = {
  mode: "s3";
  key: string;
  url: string;
  method: "PUT";
  /** Must be sent exactly (signed). The browser adds the matching Content-Length itself. */
  headers: { "Content-Type": string };
  expiresIn: number;
};

export async function signUpload(store: S3BlobStore, input: SignInput): Promise<SignedUpload> {
  const key = newPendingKey();
  const url = await store.presign(key, {
    method: "PUT",
    contentType: input.contentType,
    contentLength: input.size,
  });
  return {
    mode: "s3",
    key,
    url,
    method: "PUT",
    headers: { "Content-Type": input.contentType },
    expiresIn: PRESIGN_TTL_SECONDS,
  };
}

export type ConfirmInput = { kind: UploadKind; key: string; target?: string };

export function parseConfirmInput(body: unknown): ConfirmInput {
  if (!isObject(body)) throw new UploadError(400, "업로드 요청이 올바르지 않습니다.");
  const { kind, key, target } = body;
  if ((kind !== "image" && kind !== "pdf") || !isPendingKey(key)) {
    throw new UploadError(400, "업로드 요청이 올바르지 않습니다.");
  }
  if (kind === "image") return { kind, key };
  if (typeof target !== "string" || !isValidItemId(target)) {
    throw new UploadError(400, "잘못된 논문 id입니다.");
  }
  return { kind, key, target };
}

/** Bytes read back to identify the file (enough for every magic number we check). */
const SNIFF_BYTES = 16;

async function firstBytes(store: BlobStore, key: string): Promise<Uint8Array> {
  const read = await store.get(key, { start: 0, end: SNIFF_BYTES - 1 });
  if (!read || !("body" in read)) return new Uint8Array();
  const bytes = new Uint8Array(await new Response(read.body).arrayBuffer());
  return bytes.subarray(0, SNIFF_BYTES);
}

export type Finalized = { kind: "image"; key: string; url: string } | { kind: "pdf"; key: string };

/**
 * Checks the uploaded temporary object and copies it to its final key: a new
 * `images/<uuid>.<ext>` (type from the bytes; SVG and HEIC rejected) or `pdfs/<id>.pdf`
 * (replacing any previous file). The temporary object is always deleted, also on failure.
 */
export async function finalizeUpload(store: S3BlobStore, input: ConfirmInput): Promise<Finalized> {
  try {
    const info = await store.head(input.key);
    if (!info) throw new UploadError(404, "업로드된 파일을 찾을 수 없습니다. 다시 올려 주세요.");
    if (info.size === 0) throw new UploadError(400, "빈 파일입니다.");
    const bytes = await firstBytes(store, input.key);
    if (input.kind === "image") {
      if (info.size > MAX_IMAGE_BYTES) throw new UploadError(413, IMAGE_TOO_LARGE);
      const type = sniffImage(bytes);
      if (type === "heic") throw new UploadError(415, HEIC_MESSAGE);
      if (!type) throw new UploadError(415, NOT_IMAGE_MESSAGE);
      const name = `${crypto.randomUUID()}.${type}`;
      const key = imageKey(name);
      await store.copy(input.key, key, IMAGE_TYPES[type]);
      return { kind: "image", key, url: `${IMAGE_URL_PREFIX}${name}` };
    }
    if (info.size > MAX_PDF_BYTES) throw new UploadError(413, PDF_TOO_LARGE);
    if (!isPdfBytes(bytes)) throw new UploadError(415, "PDF 파일이 아닙니다.");
    const key = pdfKey(input.target!);
    await store.copy(input.key, key, "application/pdf");
    return { kind: "pdf", key };
  } finally {
    await store.delete(input.key).catch(() => false);
  }
}
