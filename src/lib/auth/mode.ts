import { isLocalHost } from "@/lib/host-guard";

/**
 * How the app guards access, decided from the environment and the request's Host.
 *
 * - `login`: Google sign-in required (all four auth settings present).
 * - `local`: no sign-in, as before (no auth settings, on this machine, not on Vercel).
 * - `setup`: the app does not open; a page lists the settings to fill in. Used whenever
 *   it could otherwise be served to the internet without sign-in, when the auth settings
 *   are only partly filled, and on Vercel without shared file storage (s3).
 *
 * Pure: callers pass the env and Host. Never returns values, only setting names.
 */

export const AUTH_KEYS = [
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "ALLOWED_EMAILS",
] as const;

export const S3_KEYS = [
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

export type SetupReason =
  /** Some auth settings are set, others are empty. */
  | "auth-incomplete"
  /** No auth settings while the app runs on Vercel or as a production server on a remote host. */
  | "auth-required"
  /** On Vercel without shared file storage: local files would not persist. */
  | "storage-required";

export type AuthMode =
  | { kind: "login" }
  | { kind: "local" }
  | { kind: "setup"; reasons: SetupReason[]; missing: string[] };

type Env = Readonly<Record<string, string | undefined>>;

const filled = (env: Env, key: string) => Boolean(env[key]?.trim());

export function isVercel(env: Env): boolean {
  return filled(env, "VERCEL");
}

export function resolveAuthMode(env: Env, host: string | null | undefined): AuthMode {
  const reasons: SetupReason[] = [];
  const missing: string[] = [];

  const missingAuth = AUTH_KEYS.filter((k) => !filled(env, k));
  const authComplete = missingAuth.length === 0;
  const authEmpty = missingAuth.length === AUTH_KEYS.length;
  // A remote production server must not serve the notes without sign-in.
  const exposed =
    isVercel(env) || (env.NODE_ENV === "production" && !isLocalHost(host));

  if (!authComplete && (!authEmpty || exposed)) {
    reasons.push(authEmpty ? "auth-required" : "auth-incomplete");
    missing.push(...missingAuth);
  }

  if (isVercel(env)) {
    // `BLOB_STORE=local` (e2e switch) forces local files, which Vercel cannot keep either.
    const forcedLocal = env.BLOB_STORE?.trim() === "local";
    const missingS3 = S3_KEYS.filter((k) => !filled(env, k));
    if (forcedLocal || missingS3.length > 0) {
      reasons.push("storage-required");
      missing.push(...(forcedLocal ? ["BLOB_STORE"] : missingS3));
    }
  }

  if (reasons.length > 0) return { kind: "setup", reasons, missing };
  return authComplete ? { kind: "login" } : { kind: "local" };
}
