import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Asset directories of `pdfjs-dist` that the viewer may load, with allowed file types. */
const ALLOWED: Record<string, Record<string, string>> = {
  cmaps: { ".bcmap": "application/octet-stream" },
  standard_fonts: { ".pfb": "application/x-font-type1", ".ttf": "font/ttf" },
};

const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*(\.[a-z0-9]+)$/;

export type PdfjsAsset = { path: string; contentType: string };

export function pdfjsRoot(cwd: string = process.cwd()): string {
  return join(cwd, "node_modules", "pdfjs-dist");
}

let cachedVersion: string | undefined;

/** Installed pdfjs-dist version; part of asset URLs so caches break on upgrade. */
export function pdfjsVersion(root: string = pdfjsRoot()): string {
  cachedVersion ??= (
    JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      version: string;
    }
  ).version;
  return cachedVersion;
}

/**
 * Maps `[version, dir, file]` URL segments to a file inside an allowed pdfjs-dist
 * directory, or null. Only plain file names with allowed extensions pass, so no
 * segment can escape the directory.
 */
export function resolvePdfjsAsset(
  segments: string[],
  version: string,
  root: string = pdfjsRoot(),
): PdfjsAsset | null {
  if (segments.length !== 3) return null;
  const [requestedVersion, dir, file] = segments;
  if (requestedVersion !== version) return null;
  if (!Object.hasOwn(ALLOWED, dir)) return null;
  const match = FILE_RE.exec(file);
  if (!match) return null;
  const types = ALLOWED[dir];
  const contentType = Object.hasOwn(types, match[1]) ? types[match[1]] : undefined;
  if (!contentType) return null;
  return { path: join(root, dir, file), contentType };
}
