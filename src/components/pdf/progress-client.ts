export type ReadingProgress = { page: number; scroll: number; totalPages: number };

/**
 * Sends the reading position to the progress endpoint. With `beacon`, uses
 * `navigator.sendBeacon` (survives page unload; body goes as text/plain) and
 * falls back to a keepalive fetch.
 */
export function sendProgress(
  url: string,
  progress: ReadingProgress,
  { beacon = false }: { beacon?: boolean } = {},
): void {
  const body = JSON.stringify({
    page: progress.page,
    scroll: Math.round(progress.scroll * 10_000) / 10_000,
    totalPages: progress.totalPages,
  });
  if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon?.(url, body)) return;
  fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Best effort: the next scroll saves again.
  });
}
