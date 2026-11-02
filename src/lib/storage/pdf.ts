import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";

/** Directory (relative to the project root) holding uploaded PDFs. */
export const PDF_DIR = "data/pdfs";

/** Upper bound for an uploaded PDF. */
export const MAX_PDF_BYTES = 100 * 1024 * 1024;

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SEED_RE = /^seed-[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

/**
 * Paper ids are generated UUIDs, or `seed-…` ids from the sample seed. Anything
 * else is rejected before it can reach a file path.
 */
export function isValidPaperId(id: unknown): id is string {
  return typeof id === "string" && id.length <= 80 && (UUID_RE.test(id) || SEED_RE.test(id));
}

function assertId(id: string): void {
  if (!isValidPaperId(id)) throw new PdfStorageError("invalid_id", "잘못된 논문 id입니다.");
}

/**
 * Path stored in `papers.pdf_path` (project-root relative). It is derived from the
 * id only; a path read back from the database is never used to touch the disk.
 */
export function pdfRelativePath(id: string): string {
  assertId(id);
  return `${PDF_DIR}/${id}.pdf`;
}

/** Absolute directory; `root` defaults to the working directory (tests pass a temp dir). */
export function pdfDir(root: string = process.cwd()): string {
  return resolve(root, PDF_DIR);
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

export type StorageOptions = { root?: string; maxBytes?: number };

/**
 * Writes the PDF for `id`, replacing any existing file atomically (temp file +
 * rename). Returns the relative path to store in the database.
 */
export async function writePdf(
  id: string,
  bytes: Uint8Array,
  options: StorageOptions = {},
): Promise<string> {
  const target = pdfAbsolutePath(id, options.root);
  assertPdfBytes(bytes, options.maxBytes);
  await mkdir(pdfDir(options.root), { recursive: true });
  const temp = `${target}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temp, bytes, { flag: "wx" });
    await rename(temp, target);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
  return pdfRelativePath(id);
}

/** Size in bytes, or null when no file exists for `id`. */
export async function pdfSize(id: string, options: StorageOptions = {}): Promise<number | null> {
  try {
    const info = await stat(pdfAbsolutePath(id, options.root));
    return info.isFile() ? info.size : null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function pdfExists(id: string, options: StorageOptions = {}): Promise<boolean> {
  return (await pdfSize(id, options)) !== null;
}

/** Web stream of the file, optionally limited to an inclusive byte range. */
export function readPdfStream(
  id: string,
  range?: { start: number; end: number },
  options: StorageOptions = {},
): ReadableStream<Uint8Array> {
  const stream = createReadStream(pdfAbsolutePath(id, options.root), range);
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

/** Deletes the file for `id`. Returns false when there was nothing to delete. */
export async function deletePdf(id: string, options: StorageOptions = {}): Promise<boolean> {
  const path = pdfAbsolutePath(id, options.root);
  try {
    await stat(path);
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
  await rm(path, { force: true });
  return true;
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}
