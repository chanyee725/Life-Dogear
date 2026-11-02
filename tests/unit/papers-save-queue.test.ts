import { describe, expect, it, vi } from "vitest";
import {
  createSaveQueue,
  SAVE_FAILED,
  type SaveOutcome,
  type SaveState,
} from "@/app/papers/_components/save-queue";

type Patch = { title?: string; body?: string };

function setup(save: (patch: Patch) => Promise<SaveOutcome>) {
  const states: [SaveState, string | null][] = [];
  const queue = createSaveQueue<Patch>(save, (s, e) => states.push([s, e]));
  return { queue, states };
}

describe("createSaveQueue", () => {
  it("merges edits and saves them once", async () => {
    const save = vi.fn(async () => ({ ok: true }) as const);
    const { queue, states } = setup(save);
    queue.add({ title: "a" });
    queue.add({ title: "b", body: "x" });
    await queue.flush();
    expect(save).toHaveBeenCalledExactlyOnceWith({ title: "b", body: "x" });
    expect(states.at(-1)).toEqual(["saved", null]);
    expect(queue.dirty()).toBe(false);
    await queue.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("keeps working after the save throws, retrying the lost fields", async () => {
    const save = vi
      .fn<(patch: Patch) => Promise<SaveOutcome>>()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue({ ok: true });
    const { queue, states } = setup(save);

    queue.add({ body: "first" });
    await queue.flush();
    expect(states.at(-1)).toEqual(["error", SAVE_FAILED]);
    expect(queue.pending()).toEqual({ body: "first" });
    expect(queue.dirty()).toBe(true);

    queue.add({ title: "new" });
    await queue.flush();
    expect(save).toHaveBeenLastCalledWith({ body: "first", title: "new" });
    expect(states.at(-1)).toEqual(["saved", null]);
    expect(queue.dirty()).toBe(false);
  });

  it("restores failed fields without overwriting newer edits", async () => {
    let release!: (o: SaveOutcome) => void;
    const save = vi
      .fn<(patch: Patch) => Promise<SaveOutcome>>()
      .mockImplementationOnce(() => new Promise((r) => (release = r)))
      .mockResolvedValue({ ok: true });
    const { queue, states } = setup(save);

    queue.add({ title: "old", body: "b" });
    const inFlight = queue.flush();
    await Promise.resolve();
    queue.add({ title: "newer" });
    release({ ok: false, error: "제목을 입력하세요." });
    await inFlight;
    expect(states.at(-1)).toEqual(["error", "제목을 입력하세요."]);
    expect(queue.pending()).toEqual({ title: "newer", body: "b" });
  });

  it("serialises saves", async () => {
    const order: string[] = [];
    const save = vi.fn(async (patch: Patch) => {
      order.push(`start ${patch.title}`);
      await new Promise((r) => setTimeout(r, 5));
      order.push(`end ${patch.title}`);
      return { ok: true } as const;
    });
    const { queue } = setup(save);
    queue.add({ title: "1" });
    const first = queue.flush();
    await vi.waitFor(() => expect(order).toContain("start 1"));
    queue.add({ title: "2" });
    await Promise.all([first, queue.flush()]);
    expect(order).toEqual(["start 1", "end 1", "start 2", "end 2"]);
  });
});
