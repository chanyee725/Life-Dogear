export type Debounced<A extends unknown[]> = {
  (...args: A): void;
  /** Runs the pending call now. Returns true if there was one. */
  flush: () => boolean;
  /** Drops the pending call. */
  cancel: () => void;
  pending: () => boolean;
};

/** Trailing-edge debounce: only the last call within `delay` ms runs. */
export function createDebounced<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    lastArgs = undefined;
  };

  const flush = () => {
    if (lastArgs === undefined) return false;
    const args = lastArgs;
    cancel();
    fn(...args);
    return true;
  };

  const debounced = ((...args: A) => {
    lastArgs = args;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }) as Debounced<A>;
  debounced.flush = flush;
  debounced.cancel = cancel;
  debounced.pending = () => lastArgs !== undefined;
  return debounced;
}
