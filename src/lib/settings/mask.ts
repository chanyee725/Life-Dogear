/**
 * Masking for setting values shown on `/settings`. Runs on the server only in practice: the
 * client receives the masked string, never the value. Pure so it is unit-tested directly.
 */

const DOTS = "••••••";

/** First `visible` characters, then dots; short values are hidden entirely. */
export function maskSecret(value: string, visible = 4): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= visible * 3) return DOTS;
  return `${v.slice(0, visible)}${DOTS}`;
}

/**
 * Scheme and host only (`https://calendar.google.com/••••••`): the path of a private iCal
 * address holds the secret token and an account email. Not a URL → `maskSecret`.
 */
export function maskUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  try {
    const url = new URL(v);
    if (!url.host) return maskSecret(v);
    return `${url.protocol}//${url.host}/${DOTS}`;
  } catch {
    return maskSecret(v);
  }
}
