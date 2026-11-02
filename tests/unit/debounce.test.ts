import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDebounced } from "@/lib/hooks/debounce";

describe("createDebounced", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs only the last call after the delay", () => {
    const fn = vi.fn();
    const d = createDebounced(fn, 800);
    d(1);
    vi.advanceTimersByTime(500);
    d(2);
    vi.advanceTimersByTime(799);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith(2);
    expect(d.pending()).toBe(false);
  });

  it("flushes the pending call immediately, once", () => {
    const fn = vi.fn();
    const d = createDebounced(fn, 800);
    expect(d.flush()).toBe(false);
    d("a");
    expect(d.pending()).toBe(true);
    expect(d.flush()).toBe(true);
    expect(fn).toHaveBeenCalledExactlyOnceWith("a");
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancels the pending call", () => {
    const fn = vi.fn();
    const d = createDebounced(fn, 800);
    d();
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
    expect(d.flush()).toBe(false);
  });
});
