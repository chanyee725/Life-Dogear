/**
 * Queue for saving dragged node positions (`PUT /api/graph/layout`):
 * - batches drags for `delay` ms;
 * - one request at a time, in order — keepalive flushes included;
 * - a failed batch goes back to the queue unless the node moved again since;
 * - server/network failures retry with exponential backoff (1s, 2s, 4s … 30s max), reset
 *   by a success; client errors (4xx) are not retried until the next drag or flush;
 * - `flushNow()` sends whatever is left with `keepalive` (page leave / unmount).
 * No React; the screen owns one instance.
 */
import type { GraphNodeId, GraphPosition } from "@/lib/graph/types";

/** Rejects on failure; an error with a numeric `status` (HTTP) tells 4xx from the rest. */
export type SendLayout = (batch: GraphPosition[], opts: { keepalive: boolean }) => Promise<void>;

export type LayoutSaver = {
  add: (position: GraphPosition) => void;
  /** Sends pending positions with keepalive, right after any in-flight request. */
  flushNow: () => void;
  /** Drops pending positions (layout reset) and resolves once no request is in flight. */
  clear: () => Promise<void>;
  dispose: () => void;
};

export const BACKOFF_START_MS = 1000;
export const BACKOFF_MAX_MS = 30_000;

/** Retry delay after `failures` consecutive retryable failures (1 → 1s, 2 → 2s, …, ≤ 30s). */
export function backoffDelay(failures: number): number {
  return Math.min(BACKOFF_START_MS * 2 ** Math.max(failures - 1, 0), BACKOFF_MAX_MS);
}

function isClientError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

export function createLayoutSaver(
  send: SendLayout,
  { delay = 300, onResult }: { delay?: number; onResult?: (ok: boolean) => void } = {},
): LayoutSaver {
  const pending = new Map<GraphNodeId, GraphPosition>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let failures = 0;
  /** Last failure was a 4xx: wait for the next drag or flush. */
  let stopped = false;
  let disposed = false;

  const schedule = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, ms);
  };

  const takeBatch = () => {
    const batch = [...pending.values()];
    pending.clear();
    return batch;
  };

  const requeue = (batch: GraphPosition[]) => {
    for (const p of batch) if (!pending.has(p.node)) pending.set(p.node, p);
  };

  /** Sends one batch after any in-flight request; records the outcome. */
  async function run(batch: GraphPosition[], keepalive: boolean): Promise<boolean> {
    while (inFlight) await (inFlight as Promise<void>).catch(() => undefined);
    let ok = false;
    inFlight = send(batch, { keepalive }).then(
      () => {
        ok = true;
        failures = 0;
        stopped = false;
        onResult?.(true);
      },
      (error: unknown) => {
        requeue(batch);
        if (isClientError(error)) stopped = true;
        else failures++;
        onResult?.(false);
      },
    );
    try {
      await inFlight;
    } finally {
      inFlight = null;
    }
    return ok;
  }

  async function flush(): Promise<void> {
    while (inFlight) await (inFlight as Promise<void>).catch(() => undefined);
    if (pending.size === 0) return;
    const ok = await run(takeBatch(), false);
    if (disposed || timer || pending.size === 0) return;
    if (ok)
      schedule(delay); // drags that arrived during the request
    else if (!stopped) schedule(backoffDelay(failures));
  }

  return {
    add(position) {
      pending.set(position.node, position);
      // A new drag lifts a 4xx stop, but does not cut a backoff wait short.
      if (failures > 0 && timer) return;
      stopped = false;
      schedule(delay);
    },
    flushNow() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (pending.size === 0) return;
      stopped = false;
      void run(takeBatch(), true);
    },
    async clear() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending.clear();
      failures = 0;
      stopped = false;
      while (inFlight) await (inFlight as Promise<void>).catch(() => undefined);
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
