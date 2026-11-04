import type { Env } from "@/lib/data-dir";
import { s3Store, type PresignOptions } from "./blob";
import { describeError } from "./describe-error";

/**
 * s3 mode: a presigned GET (5 minutes) for `key` with the response headers fixed, when the
 * bucket has the file. Null in local mode, when the bucket lacks the file (it may still be in
 * the local folder from before `storage:push`) or when the bucket check fails (logged without
 * details); callers then serve the bytes themselves as before.
 */
export async function presignedReadUrl(
  key: string,
  response: NonNullable<PresignOptions["response"]>,
  env: Env = process.env,
): Promise<string | null> {
  const store = s3Store(env);
  if (!store) return null;
  try {
    if (!(await store.head(key))) return null;
    return await store.presign(key, { method: "GET", response });
  } catch (error) {
    console.error("[storage] presign failed, serving directly:", describeError(error));
    return null;
  }
}

/** A redirect to a presigned URL; `maxAge` must stay below the URL's lifetime. */
export function redirectTo(url: string, maxAge: number): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": maxAge > 0 ? `private, max-age=${maxAge}` : "private, no-store",
    },
  });
}
