import { join, resolve } from "node:path";
import { pdfDirSetting } from "@/lib/data-dir";
import { isValidItemId } from "@/lib/ids";
import {
  blobStore,
  type BlobRead,
  type BlobUnsatisfiable,
  type StoreOptions as BlobOptions,
} from "./blob";
import type { RangeSpec } from "./range";

/**
 * Directory holding uploaded PDFs: `<DATA_DIR>/pdfs`, relative to the project root
 * unless DATA_DIR is absolute. Read per call so tests and e2e can change DATA_DIR.
 */
export const pdfDirPath = (): string => pdfDirSetting();

/** Upper bound for an uploaded PDF. */
export const MAX_PDF_BYTES = 100 * 1024 * 1024;

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export type PdfStorageErrorCode = "invalid_id" | "empty" | "too_large" | "not_pdf";

export class PdfStorageError extends Error {
  constructor(
    readonly code: PdfStorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PdfStorageError";
  }
}

function assertId(id: string): void {
  if (!isValidItemId(id)) throw new PdfStorageError("invalid_id", "잘못된 논문 id입니다.");
}

/**
 * Path stored in `papers.pdf_path` (project-root relative). It is derived from the
 * id only; a path read back from the database is never used to touch the disk.
 */
export function pdfRelativePath(id: string): string {
  assertId(id);
  return `${pdfDirPath()}/${id}.pdf`;
}

/** Absolute directory; `root` defaults to the working directory (tests pass a temp dir). */
export function pdfDir(root: string = process.cwd()): string {
  return resolve(root, pdfDirPath());
}

export function pdfAbsolutePath(id: string, root?: string): string {
  assertId(id);
  return join(pdfDir(root), `${id}.pdf`);
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length >= PDF_MAGIC.length && PDF_MAGIC.every((b, i) => bytes[i] === b);
}

/** Validates size and magic bytes, throwing a {@link PdfStorageError}. */
export function assertPdfBytes(bytes: Uint8Array, maxBytes: number = MAX_PDF_BYTES): void {
  if (bytes.length === 0) throw new PdfStorageError("empty", "빈 파일입니다.");
  if (bytes.length > maxBytes) {
    throw new PdfStorageError("too_large", "파일이 너무 큽니다.");
  }
  if (!isPdfBytes(bytes)) throw new PdfStorageError("not_pdf", "PDF 파일이 아닙니다.");
}

export type StorageOptions = BlobOptions & { maxBytes?: number };

/** Storage key: `pdfs/<id>.pdf` (local: `<DATA_DIR>/pdfs/<id>.pdf`). */
export function pdfKey(id: string): string {
  assertId(id);
  return `pdfs/${id}.pdf`;
}

/**
 * Writes the PDF for `id`, replacing any existing file (atomically on disk). Returns the
 * relative path to store in the database.
 */
export async function writePdf(
  id: string,
  bytes: Uint8Array,
  options: StorageOptions = {},
): Promise<string> {
  const key = pdfKey(id);
  assertPdfBytes(bytes, options.maxBytes);
  await blobStore(options).put(key, bytes, "application/pdf");
  return pdfRelativePath(id);
}

/** Size in bytes, or null when no file exists for `id`. */
export async function pdfSize(id: string, options: StorageOptions = {}): Promise<number | null> {
  return (await blobStore(options).head(pdfKey(id)))?.size ?? null;
}

export async function pdfExists(id: string, options: StorageOptions = {}): Promise<boolean> {
  return (await pdfSize(id, options)) !== null;
}

/**
 * The file, or the part a `Range` spec asks for (one ranged GET on the bucket); null when
 * there is no file, `{ unsatisfiable }` when the range starts past the end.
 */
export async function openPdf(
  id: string,
  range?: RangeSpec,
  options: StorageOptions = {},
): Promise<BlobRead | BlobUnsatisfiable | null> {
  return blobStore(options).get(pdfKey(id), range);
}

/** Deletes the file for `id`. Returns false when there was nothing to delete. */
export async function deletePdf(id: string, options: StorageOptions = {}): Promise<boolean> {
  return blobStore(options).delete(pdfKey(id));
}
