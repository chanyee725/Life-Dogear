import { useEffect, useRef, useState } from "react";
import { createDebounced, type Debounced } from "./debounce";

export type { Debounced };

/**
 * Stable debounced wrapper around the latest `fn`. The returned function keeps
 * its identity across renders; `flush()` runs a pending call immediately.
 * With `flushOnUnmount`, a pending call runs when the component unmounts.
 * `delay` is read once, on the first render.
 */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
  options: { flushOnUnmount?: boolean } = {},
): Debounced<A> {
  const fnRef = useRef(fn);
  const flushOnUnmount = useRef(options.flushOnUnmount ?? false);

  useEffect(() => {
    fnRef.current = fn;
    flushOnUnmount.current = options.flushOnUnmount ?? false;
  });

  const [debounced] = useState(() =>
    createDebounced<A>((...args) => fnRef.current(...args), delay),
  );

  useEffect(
    () => () => {
      if (flushOnUnmount.current) debounced.flush();
      else debounced.cancel();
    },
    [debounced],
  );

  return debounced;
}
