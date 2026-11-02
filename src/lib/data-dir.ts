import { isAbsolute, posix } from "node:path";

/**
 * Root folder for local data (SQLite file and PDFs). `DATA_DIR` may be relative to
 * the project root or absolute; default `data`. e2e runs point it elsewhere so they
 * never touch the user's files.
 */
export const DEFAULT_DATA_DIR = "data";

/** Subset of process.env these helpers read (plain objects work in tests). */
export type Env = Readonly<Record<string, string | undefined>>;

/** Normalized `DATA_DIR`: forward slashes, no `./` prefix or trailing slash. */
export function dataDir(env: Env = process.env): string {
  const raw = env.DATA_DIR?.trim().replace(/\\/g, "/") || DEFAULT_DATA_DIR;
  const normalized = posix.normalize(raw).replace(/\/+$/, "");
  if (normalized === "") return "/"; // DATA_DIR="/" — odd but absolute
  return isAbsolute(raw) ? normalized : normalized.replace(/^\.\/(?=.)/, "");
}

/** PDF folder, as stored in `papers.pdf_path` prefixes (`<DATA_DIR>/pdfs`). */
export const pdfDirSetting = (env: Env = process.env): string => `${dataDir(env)}/pdfs`;

/** Default SQLite URL when `DATABASE_URL` is not set. */
export const localDatabaseUrl = (env: Env = process.env): string => `file:${dataDir(env)}/local.db`;
