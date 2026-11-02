/**
 * Rejects cross-site requests to mutating endpoints (CSRF guard for a local,
 * cookie-less app that any open web page could otherwise POST to).
 * - `Sec-Fetch-Site`, when sent, must be `same-origin` or `none` (typed URL, tools).
 * - `Origin`, when sent, must match the `Host` the request was addressed to.
 * Requests without either header (curl, server-side calls) are allowed.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") return false;

  const origin = headers.get("origin");
  if (origin === null) return true;
  const host = headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host.toLowerCase();
  } catch {
    // Includes the literal "null" origin (sandboxed frames, file://).
    return false;
  }
}
