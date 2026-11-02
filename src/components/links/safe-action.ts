import type { ActionResult } from "@/app/_actions/result";

export const NETWORK_ERROR = "연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";

/**
 * Calls a server action and never throws: network failures or server crashes become
 * `{ ok: false }`, so callers inside `startTransition` can just show the message.
 */
export async function safeAction<T>(
  call: () => Promise<ActionResult<T>>,
  fallback = NETWORK_ERROR,
): Promise<ActionResult<T>> {
  try {
    return await call();
  } catch {
    return { ok: false, error: fallback };
  }
}
