import { addLinerMemo } from "@/app/_actions/liner";
import { safeAction } from "@/components/links/safe-action";
import type { LinerMemoSubmit } from "./LinerMemoDialog";

/**
 * `LinerMemoDialog` submit that saves on the server (for screens without an open
 * body editor). `onSaved` receives the new body.
 */
export function serverLinerMemoSubmit(
  paperId: string,
  onSaved?: (body: string) => void,
): LinerMemoSubmit {
  return async (input) => {
    const result = await safeAction(() => addLinerMemo(paperId, input));
    if (!result.ok) return result.error;
    onSaved?.(result.data.body);
    return null;
  };
}
