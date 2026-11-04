import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Proof that the server signed a direct upload: the pending key, kind, target paper, size
 * and an expiry, sealed with an HMAC. Confirm accepts only what sign issued, so a client
 * cannot confirm someone else's key or switch the target paper.
 *
 * The HMAC key is derived from the bucket secret (present whenever direct uploads are on)
 * with a fixed label, so the secret itself is never used directly and no new setting is
 * needed. Tokens are opaque to the browser and never logged.
 */
export type UploadClaims = {
  key: string;
  kind: "image" | "pdf";
  target?: string;
  size: number;
  /** Expiry, epoch milliseconds. */
  exp: number;
};

/** Long enough for a slow 100 MB upload; `pending/` objects older than this are gc'd. */
export const UPLOAD_TOKEN_TTL_MS = 60 * 60 * 1000;

export const uploadTokenKey = (bucketSecret: string): Buffer =>
  createHmac("sha256", bucketSecret).update("research-brain/upload-token/v1").digest();

const mac = (key: Buffer, payload: string) =>
  createHmac("sha256", key).update(payload).digest("base64url");

export function issueUploadToken(key: Buffer, claims: UploadClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${mac(key, payload)}`;
}

/** The claims when the token is ours, intact and not expired; otherwise null. */
export function verifyUploadToken(
  key: Buffer,
  token: unknown,
  now: number = Date.now(),
): UploadClaims | null {
  if (typeof token !== "string" || token.length > 1024) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(mac(key, payload));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let claims: UploadClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UploadClaims;
  } catch {
    return null;
  }
  if (typeof claims?.exp !== "number" || claims.exp <= now) return null;
  return claims;
}
