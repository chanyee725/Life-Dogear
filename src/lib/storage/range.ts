export type ByteRange = { start: number; end: number };

/**
 * Parses a single-range `Range` header against a file of `size` bytes.
 * - `null`: no usable header (missing, multi-range or malformed) → serve the full file.
 * - `"unsatisfiable"`: syntactically valid but outside the file → 416.
 * - otherwise an inclusive byte range.
 */
export function parseRange(
  header: string | null | undefined,
  size: number,
): ByteRange | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  if (!rawStart) {
    // Suffix range: the last N bytes.
    const length = Number(rawEnd);
    if (length === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - length), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;
  if (rawEnd && end < start) return null;
  if (start >= size) return "unsatisfiable";
  return { start, end: Math.min(end, size - 1) };
}
