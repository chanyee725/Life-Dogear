export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

export type SaveOutcome = { ok: true } | { ok: false; error: string };

export const SAVE_FAILED = "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export type SaveQueue<P extends object> = {
  /** Merges fields into the pending patch (later values win). */
  add: (patch: P) => void;
  /** Sends the pending patch after any save in flight. Never rejects. */
  flush: () => Promise<void>;
  /** True while there are unsent fields or a save is in flight. */
  dirty: () => boolean;
  pending: () => P;
};

/**
 * Serialised autosave queue. Saves run one at a time; a failed or throwing save
 * puts its fields back (unless edited again meanwhile) so the next flush retries
 * them, and the chain keeps working after any failure.
 */
export function createSaveQueue<P extends object>(
  save: (patch: P) => Promise<SaveOutcome>,
  onState: (state: SaveState, error: string | null) => void,
): SaveQueue<P> {
  let pending = {} as P;
  let busy = false;
  let chain: Promise<void> = Promise.resolve();

  const isEmpty = (patch: P) => Object.keys(patch).length === 0;

  async function run() {
    const patch = pending;
    if (isEmpty(patch)) return;
    pending = {} as P;
    busy = true;
    onState("saving", null);
    let outcome: SaveOutcome;
    try {
      outcome = await save(patch);
    } catch {
      outcome = { ok: false, error: SAVE_FAILED };
    }
    busy = false;
    if (outcome.ok) {
      onState(isEmpty(pending) ? "saved" : "pending", null);
    } else {
      pending = { ...patch, ...pending };
      onState("error", outcome.error);
    }
  }

  return {
    add(patch) {
      pending = { ...pending, ...patch };
      onState("pending", null);
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
