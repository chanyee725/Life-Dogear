/**
 * Queue for saving dragged node positions (`PUT /api/graph/layout`):
 * - batches drags for `delay` ms;
 * - one request at a time, in order (the next batch waits for the previous one);
 * - a failed batch goes back to the queue unless the node moved again since;
 * - `flushNow()` sends whatever is left with `keepalive` (page leave / unmount).
 * No React; the screen owns one instance.
 */
import type { GraphNodeId, GraphPosition } from "@/lib/graph/types";

export type SendLayout = (batch: GraphPosition[], opts: { keepalive: boolean }) => Promise<void>;

export type LayoutSaver = {
  add: (position: GraphPosition) => void;
  /** Sends pending positions immediately with keepalive (does not wait for an in-flight request). */
  flushNow: () => void;
  /** Drops pending positions (layout reset) and resolves once no request is in flight. */
  clear: () => Promise<void>;
  dispose: () => void;
};

export function createLayoutSaver(
  send: SendLayout,
  { delay = 300, onResult }: { delay?: number; onResult?: (ok: boolean) => void } = {},
): LayoutSaver {
  const pending = new Map<GraphNodeId, GraphPosition>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let disposed = false;

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delay);
  };

  const takeBatch = () => {
    const batch = [...pending.values()];
    pending.clear();
    return batch;
  };

  const requeue = (batch: GraphPosition[]) => {
    for (const p of batch) if (!pending.has(p.node)) pending.set(p.node, p);
  };

  async function flush(): Promise<void> {
    // Keep order: send the next batch only after the current request finishes.
    while (inFlight) await (inFlight as Promise<void>).catch(() => undefined);
    if (pending.size === 0) return;
    const batch = takeBatch();
    inFlight = send(batch, { keepalive: false }).then(
      () => onResult?.(true),
      () => {
        requeue(batch);
        onResult?.(false);
      },
    );
    try {
      await inFlight;
    } finally {
      inFlight = null;
    }
    // Drags that arrived while the request was in flight.
    if (pending.size > 0 && !timer && !disposed) schedule();
  }

  return {
    add(position) {
      pending.set(position.node, position);
      schedule();
    },
    flushNow() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (pending.size === 0) return;
      const batch = takeBatch();
      send(batch, { keepalive: true }).catch(() => requeue(batch));
    },
    async clear() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending.clear();
      await inFlight?.catch(() => undefined);
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
