import type { ActionResult } from "@/app/_actions/result";

export const NETWORK_ERROR = "연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";

/**
 * Calls a server action and never throws: network failures or server crashes become
 * `{ ok: false }` (Next.js redirect/notFound errors are rethrown), so callers inside `startTransition` can just show the message.
 */
export async function safeAction<T>(
  call: () => Promise<ActionResult<T>>,
  fallback = NETWORK_ERROR,
): Promise<ActionResult<T>> {
  try {
    return await call();
  } catch (error) {
    // Let Next.js control-flow errors (redirect, notFound, …) propagate.
    if (isNextControlError(error)) throw error;
    return { ok: false, error: fallback };
  }
}

/** Errors thrown by `redirect()` / `notFound()` / `forbidden()` carry these digests. */
function isNextControlError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  );
}
