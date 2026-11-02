import { RepoError } from "@/lib/repo";

/** Shape every server action returns, so forms can show a Korean error inline. */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export const GENERIC_ERROR = "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

/** Turns thrown errors into `{ ok: false }`. RepoError messages are user-facing. */
export function toFailure(error: unknown): { ok: false; error: string } {
  if (error instanceof RepoError) return { ok: false, error: error.message };
  // Log only the error kind: messages can carry query params (user content).
  console.error("[action] unexpected error", describeError(error));
  return { ok: false, error: GENERIC_ERROR };
}

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    return toFailure(error);
  }
}

/** `Name` or `Name(code)` — never the message, stack or params. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" || typeof code === "number"
    ? `${error.name}(${code})`
    : error.name;
}
