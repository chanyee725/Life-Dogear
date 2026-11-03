export type ByteRange = { start: number; end: number };

/**
 * A single range as asked for, before the file size is known: `bytes=a-b`, `bytes=a-`
 * (`end` omitted) or `bytes=-n` (`suffix`). Storage resolves it against the real size, so
 * a bucket answers it with one ranged GET.
 */
export type RangeSpec = { start: number; end?: number } | { suffix: number };

/** Parses a single-range `Range` header; null for none, multi-range or malformed headers. */
export function parseRangeHeader(header: string | null | undefined): RangeSpec | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;
  if (!rawStart) return { suffix: Number(rawEnd) };
  const start = Number(rawStart);
  if (!rawEnd) return { start };
  const end = Number(rawEnd);
  return end < start ? null : { start, end };
}

/** The inclusive range a spec covers in a file of `size` bytes, or "unsatisfiable" (416). */
export function resolveRange(spec: RangeSpec, size: number): ByteRange | "unsatisfiable" {
  if ("suffix" in spec) {
    if (spec.suffix === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - spec.suffix), end: size - 1 };
  }
  if (spec.start >= size) return "unsatisfiable";
  return { start: spec.start, end: Math.min(spec.end ?? size - 1, size - 1) };
}

/** `Range` header value for a spec. */
export function rangeHeader(spec: RangeSpec): string {
  if ("suffix" in spec) return `bytes=-${spec.suffix}`;
  return `bytes=${spec.start}-${spec.end ?? ""}`;
}

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
  const spec = parseRangeHeader(header);
  return spec && resolveRange(spec, size);
}
