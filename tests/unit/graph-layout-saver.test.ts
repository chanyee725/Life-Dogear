import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLayoutSaver, type SendLayout } from "@/components/graph/layout-saver";
import type { GraphNodeId, GraphPosition } from "@/lib/graph/types";

const pos = (id: string, x: number): GraphPosition => ({
  node: `paper:${id}` as GraphNodeId,
  x,
  y: 0,
});

type Call = { batch: GraphPosition[]; keepalive: boolean; resolve: () => void; reject: () => void };

/** A send() whose requests stay open until the test settles them. */
function controlledSend() {
  const calls: Call[] = [];
  const send: SendLayout = (batch, { keepalive }) =>
    new Promise<void>((resolve, reject) =>
      calls.push({ batch, keepalive, resolve, reject: () => reject(new Error("x")) }),
    );
  return { calls, send };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createLayoutSaver", () => {
  it("batches drags within the delay into one request", async () => {
    const { calls, send } = controlledSend();
    const saver = createLayoutSaver(send, { delay: 300 });
    saver.add(pos("a", 1));
    saver.add(pos("b", 2));
    saver.add(pos("a", 3));
    await vi.advanceTimersByTimeAsync(299);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.batch).toEqual([pos("a", 3), pos("b", 2)]);
    expect(calls[0]!.keepalive).toBe(false);
  });

  it("sends the next batch only after the previous request finished", async () => {
    const { calls, send } = controlledSend();
    const saver = createLayoutSaver(send, { delay: 300 });
    saver.add(pos("a", 1));
    await vi.advanceTimersByTimeAsync(300);
    saver.add(pos("b", 2));
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(1);
    calls[0]!.resolve();
    await vi.advanceTimersByTimeAsync(300);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.batch).toEqual([pos("b", 2)]);
  });

  it("puts a failed batch back unless the node moved again, and reports the result", async () => {
    const { calls, send } = controlledSend();
    const results: boolean[] = [];
    const saver = createLayoutSaver(send, { delay: 300, onResult: (ok) => results.push(ok) });
    saver.add(pos("a", 1));
    saver.add(pos("b", 1));
    await vi.advanceTimersByTimeAsync(300);
    saver.add(pos("a", 9)); // newer position for a while the first PUT is open
    calls[0]!.reject();
    await vi.advanceTimersByTimeAsync(300);
    expect(results).toEqual([false]);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.batch).toEqual([pos("a", 9), pos("b", 1)]);
    calls[1]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(results).toEqual([false, true]);
  });

  it("flushNow sends what is pending at once with keepalive", async () => {
    const { calls, send } = controlledSend();
    const saver = createLayoutSaver(send, { delay: 300 });
    saver.add(pos("a", 1));
    saver.flushNow();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.keepalive).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(1);
    saver.flushNow(); // nothing pending
    expect(calls).toHaveLength(1);
  });

  it("clear drops pending drags and waits for the in-flight request", async () => {
    const { calls, send } = controlledSend();
    const saver = createLayoutSaver(send, { delay: 300 });
    saver.add(pos("a", 1));
    await vi.advanceTimersByTimeAsync(300);
    saver.add(pos("b", 2));
    let cleared = false;
    const done = saver.clear().then(() => (cleared = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(cleared).toBe(false);
    calls[0]!.resolve();
    await done;
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(1);
  });
});
