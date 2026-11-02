export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

export type SaveOutcome = { ok: true } | { ok: false; error: string };

export const SAVE_FAILED = "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export type SaveQueue<P extends object> = {
  /**
   * Merges fields into the pending patch (later values win). Fields equal to the
   * last saved (server) value are dropped, so re-entering the original value or
   * echoing initial values never triggers a save.
   */
  add: (patch: P) => void;
  /** Sends the pending patch after any save in flight. Never rejects. */
  flush: () => Promise<void>;
  /** True while there are unsent fields or a save is in flight. */
  dirty: () => boolean;
  pending: () => P;
};

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Serialised autosave queue. Saves run one at a time; a failed or throwing save
 * puts its fields back (unless edited again meanwhile) so the next flush retries
 * them, and the chain keeps working after any failure. `baseline` holds the values
 * currently stored on the server and advances with each successful save.
 */
export function createSaveQueue<P extends object>(
  save: (patch: P) => Promise<SaveOutcome>,
  onState: (state: SaveState, error: string | null) => void,
  baseline: P = {} as P,
): SaveQueue<P> {
  let saved: Record<string, unknown> = { ...(baseline as Record<string, unknown>) };
  let pending = {} as P;
  /** Patch being saved right now; counts as the server value while in flight. */
  let inflight: Record<string, unknown> = {};
  let busy = false;
  let chain: Promise<void> = Promise.resolve();

  const isEmpty = (patch: P) => Object.keys(patch).length === 0;

  async function run() {
    const patch = pending;
    if (isEmpty(patch)) return;
    pending = {} as P;
    inflight = { ...(patch as Record<string, unknown>) };
    busy = true;
    onState("saving", null);
    let outcome: SaveOutcome;
    try {
      outcome = await save(patch);
    } catch {
      outcome = { ok: false, error: SAVE_FAILED };
    }
    busy = false;
    inflight = {};
    if (outcome.ok) {
      saved = { ...saved, ...(patch as Record<string, unknown>) };
      onState(isEmpty(pending) ? "saved" : "pending", null);
    } else {
      pending = { ...patch, ...pending };
      onState("error", outcome.error);
    }
  }

  return {
    add(patch) {
      const current = { ...saved, ...inflight };
      const next: Record<string, unknown> = { ...(pending as Record<string, unknown>) };
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        if (Object.hasOwn(current, key) && sameValue(current[key], value)) delete next[key];
        else next[key] = value;
      }
      if (sameValue(next, pending)) return;
      pending = next as P;
      onState(!isEmpty(pending) ? "pending" : busy ? "saving" : "idle", null);
    },
    flush() {
      chain = chain.then(run).catch(() => {
        // run() handles its own errors; this only guards the chain.
      });
      return chain;
    },
    dirty: () => busy || !isEmpty(pending),
    pending: () => pending,
  };
}
