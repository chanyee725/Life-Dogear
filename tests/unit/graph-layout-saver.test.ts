import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backoffDelay, createLayoutSaver, type SendLayout } from "@/components/graph/layout-saver";
import type { GraphNodeId, GraphPosition } from "@/lib/graph/types";

const pos = (id: string, x: number): GraphPosition => ({
  node: `paper:${id}` as GraphNodeId,
  x,
  y: 0,
});

type Call = {
  batch: GraphPosition[];
  keepalive: boolean;
  resolve: () => void;
  reject: (status?: number) => void;
};

/** A send() whose requests stay open until the test settles them. */
function controlledSend() {
  const calls: Call[] = [];
  const send: SendLayout = (batch, { keepalive }) =>
    new Promise<void>((resolve, reject) =>
      calls.push({
        batch,
        keepalive,
        resolve,
        reject: (status?: number) =>
          reject(Object.assign(new Error("x"), status ? { status } : {})),
      }),
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
    calls[0]!.reject(500);
    await vi.advanceTimersByTimeAsync(1000); // first retry after 1s
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

describe("retry backoff", () => {
  it("doubles from 1s and caps at 30s", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(backoffDelay)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ]);
  });

  it("retries server failures at 1s, 2s, 4s and resets after a success", async () => {
    const { calls, send } = controlledSend();
    const saver = createLayoutSaver(send, { delay: 300 });
    saver.add(pos("a", 1));
    await vi.advanceTimersByTimeAsync(300);
    calls[0]!.reject(503);
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(2);
    calls[1]!.reject(); // network error (no status): also retried
    await vi.advanceTimersByTimeAsync(1999);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(3);
    calls[2]!.reject(500);
    await vi.advanceTimersByTimeAsync(4000);
    expect(calls).toHaveLength(4);
    calls[3]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    // Success resets the backoff: the next failure waits 1s again.
    saver.add(pos("b", 1));
    await vi.advanceTimersByTimeAsync(300);
    expect(calls).toHaveLength(5);
    calls[4]!.reject(500);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(6);
  });

  it("does not let a new drag cut a backoff wait short", async () => {
    const { calls, send } = controlledSend();
    const saver = createLayoutSaver(send, { delay: 300 });
    saver.add(pos("a", 1));
    await vi.advanceTimersByTimeAsync(300);
    calls[0]!.reject(500);
    await vi.advanceTimersByTimeAsync(1000);
    calls[1]!.reject(500); // now waiting 2s
    await vi.advanceTimersByTimeAsync(100);
    saver.add(pos("b", 1));
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(900);
    expect(calls).toHaveLength(3);
    expect(calls[2]!.batch).toEqual([pos("a", 1), pos("b", 1)]);
  });

  it("does not retry a 4xx until the next drag or flush", async () => {
    const { calls, send } = controlledSend();
    const results: boolean[] = [];
    const saver = createLayoutSaver(send, { delay: 300, onResult: (ok) => results.push(ok) });
    saver.add(pos("a", 1));
    await vi.advanceTimersByTimeAsync(300);
    calls[0]!.reject(400);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(1);
    expect(results).toEqual([false]);
    saver.add(pos("b", 1));
    await vi.advanceTimersByTimeAsync(300);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.batch).toEqual([pos("a", 1), pos("b", 1)]);
    calls[1]!.reject(413);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(2);
    saver.flushNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(3);
    expect(calls[2]!.keepalive).toBe(true);
  });
});

describe("flushNow ordering", () => {
  it("waits for the in-flight request, then sends with keepalive", async () => {
    const { calls, send } = controlledSend();
    const saver = createLayoutSaver(send, { delay: 300 });
    saver.add(pos("a", 1));
    await vi.advanceTimersByTimeAsync(300);
    saver.add(pos("b", 2));
    saver.flushNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);
    calls[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ batch: [pos("b", 2)], keepalive: true });
    // The timer was cancelled: no duplicate send of b.
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(2);
  });
});
