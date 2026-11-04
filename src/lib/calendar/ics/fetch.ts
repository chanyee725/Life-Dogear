import "server-only";
/**
 * Fetches one ICS feed with a time limit and a size cap. Errors never carry the URL:
 * `IcsFetchError` holds only a short code, so `describeError` logs `IcsFetchError(<code>)`.
 */

export const FETCH_TIMEOUT_MS = 8000;
export const MAX_ICS_BYTES = 5 * 1024 * 1024;

export class IcsFetchError extends Error {
  override name = "IcsFetchError";
  constructor(readonly code: string) {
    super(code);
  }
}

/** The feed URL as https (Google also hands out `webcal://`), or null when unusable. */
export function feedUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.replace(/^webcals?:\/\//i, "https://"));
  } catch {
    return null;
  }
  return url.protocol === "https:" && !url.username && !url.password ? url : null;
}

export async function fetchIcs(
  url: URL,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; maxBytes?: number } = {},
): Promise<string> {
  const { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS, maxBytes = MAX_ICS_BYTES } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        signal: controller.signal,
        headers: { accept: "text/calendar" },
        cache: "no-store",
        redirect: "follow",
      });
    } catch {
      throw new IcsFetchError(controller.signal.aborted ? "timeout" : "network");
    }
    if (!res.ok) throw new IcsFetchError(`http_${res.status}`);
    // A redirect must not downgrade to plain http (the body is private).
    if (res.url && !res.url.startsWith("https:")) throw new IcsFetchError("insecure_redirect");
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) throw new IcsFetchError("too_large");
    if (!res.body) return "";

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new IcsFetchError("too_large");
        }
        chunks.push(value);
      }
    } catch (error) {
      if (error instanceof IcsFetchError) throw error;
      throw new IcsFetchError(controller.signal.aborted ? "timeout" : "read");
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  } finally {
    clearTimeout(timer);
  }
}
