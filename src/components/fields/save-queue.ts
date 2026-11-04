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
  /**
   * Replaces the server baseline (e.g. after a refresh) when nothing is unsaved.
   * Returns false, leaving the baseline alone, while edits are pending or saving.
   */
  resetBaseline: (baseline: P) => boolean;
  /**
   * Overwrites some baseline fields, keeping the rest, under the same rule as
   * `resetBaseline`: returns false and changes nothing while edits are pending or saving.
   * The caller must make sure the values are still current: a value read before a later
   * save of the same field would wind the baseline back past it.
   */
  rebase: (fields: Partial<P>) => boolean;
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
    resetBaseline(baseline) {
      if (busy || !isEmpty(pending)) return false;
      saved = { ...(baseline as Record<string, unknown>) };
      return true;
    },
    rebase(fields) {
      if (busy || !isEmpty(pending)) return false;
      saved = { ...saved, ...(fields as Record<string, unknown>) };
      return true;
    },
    pending: () => pending,
  };
}

/**
 * Offers a re-read baseline to `queue` (e.g. once an editor has normalised its content).
 * The queue refuses it while a save is running; then only `field` is held and put into
 * the baseline by `settle()` once the queue is idle, so the normalised value doesn't
 * go out with the next save. Call `settle()` after every flush. Before adding a read,
 * leave `field` out while `isHeld()` says it is the held value; after adding, `drop()`
 * once the queue carries a newer value for `field`: the held one is stale from then on.
 */
export function createHeldBaseline<P extends object>(queue: SaveQueue<P>, field: keyof P) {
  let held: Partial<P> | null = null;
  return {
    offer(baseline: P) {
      if (queue.resetBaseline(baseline)) held = null;
      else if (field in baseline) held = { [field]: baseline[field] } as Partial<P>;
    },
    settle() {
      if (held && queue.rebase(held)) held = null;
    },
    drop() {
      held = null;
    },
    /** True while `value` is the held (editor-ready) value of `field`. */
    isHeld(value: unknown) {
      return held !== null && sameValue(held[field], value);
    },
  };
}

/**
 * Sends values one at a time and only the newest: calls made while a send is in
 * flight replace each other, and the latest goes out when the current one ends.
 * Requests therefore reach the server in order (no older list saved last), and
 * `onSettled` reports only the outcome of the value that is final for now.
 * Throwing sends count as failures.
 */
export function createLatestSender<T>(
  send: (value: T) => Promise<SaveOutcome>,
  onSettled: (outcome: SaveOutcome) => void,
  /** Called with true when sending starts and false when the last send ends. */
  onBusy: (busy: boolean) => void = () => {},
): (value: T) => Promise<void> {
  let running: Promise<void> | null = null;
  let next: { value: T } | null = null;

  async function drain() {
    onBusy(true);
    try {
      while (next) {
        const { value } = next;
        next = null;
        let outcome: SaveOutcome;
        try {
          outcome = await send(value);
        } catch {
          outcome = { ok: false, error: SAVE_FAILED };
        }
        if (!next) onSettled(outcome);
      }
    } finally {
      running = null;
      onBusy(false);
    }
  }

  return (value: T) => {
    next = { value };
    running ??= drain();
    return running;
  };
}
