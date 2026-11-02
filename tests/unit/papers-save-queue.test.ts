import { describe, expect, it, vi } from "vitest";
import {
  createLatestSender,
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

  describe("with a server baseline", () => {
    const baseline: Patch = { title: "제목", body: "## 왜 읽나\n" };

    it("ignores values equal to what the server has (opening the page saves nothing)", async () => {
      const save = vi.fn(async () => ({ ok: true }) as const);
      const states: SaveState[] = [];
      const queue = createSaveQueue<Patch>(save, (s) => states.push(s), baseline);
      queue.add({ title: "제목", body: "## 왜 읽나\n" });
      expect(queue.dirty()).toBe(false);
      await queue.flush();
      expect(save).not.toHaveBeenCalled();
      expect(states).toEqual([]);
    });

    it("drops a field the user changed back to the server value", async () => {
      const save = vi.fn(async () => ({ ok: true }) as const);
      const states: SaveState[] = [];
      const queue = createSaveQueue<Patch>(save, (s) => states.push(s), baseline);
      queue.add({ title: "다른 제목" });
      expect(queue.dirty()).toBe(true);
      queue.add({ title: "제목" });
      expect(queue.dirty()).toBe(false);
      expect(states).toEqual(["pending", "idle"]);
      await queue.flush();
      expect(save).not.toHaveBeenCalled();
    });

    it("advances the baseline after a save", async () => {
      const save = vi.fn(async () => ({ ok: true }) as const);
      const queue = createSaveQueue<Patch>(save, () => {}, baseline);
      queue.add({ title: "새 제목" });
      await queue.flush();
      expect(save).toHaveBeenCalledExactlyOnceWith({ title: "새 제목" });
      queue.add({ title: "새 제목" });
      expect(queue.dirty()).toBe(false);
      queue.add({ title: "제목" });
      expect(queue.pending()).toEqual({ title: "제목" });
    });

    it("compares against a save in flight", async () => {
      let release!: (o: SaveOutcome) => void;
      const save = vi
        .fn<(patch: Patch) => Promise<SaveOutcome>>()
        .mockImplementationOnce(() => new Promise((r) => (release = r)))
        .mockResolvedValue({ ok: true });
      const queue = createSaveQueue<Patch>(save, () => {}, baseline);
      queue.add({ title: "A" });
      const inFlight = queue.flush();
      await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
      queue.add({ title: "A" }); // same as what is being saved
      expect(queue.pending()).toEqual({});
      queue.add({ title: "제목" }); // back to the old server value: must be saved
      expect(queue.pending()).toEqual({ title: "제목" });
      release({ ok: true });
      await inFlight;
      await queue.flush();
      expect(save).toHaveBeenLastCalledWith({ title: "제목" });
    });

    it("adopts a refreshed baseline only when nothing is unsaved", async () => {
      const save = vi.fn(async () => ({ ok: true }) as const);
      const queue = createSaveQueue<Patch>(save, () => {}, baseline);
      // Another tab saved "서버 제목"; the page refreshes with it.
      expect(queue.resetBaseline({ ...baseline, title: "서버 제목" })).toBe(true);
      queue.add({ title: "서버 제목" });
      expect(queue.dirty()).toBe(false);

      queue.add({ title: "내 편집" });
      expect(queue.resetBaseline({ ...baseline, title: "또 다른 값" })).toBe(false);
      await queue.flush();
      expect(save).toHaveBeenCalledExactlyOnceWith({ title: "내 편집" });
    });
  });
});

describe("createLatestSender", () => {
  it("sends in order, skips superseded values and reports only the final outcome", async () => {
    const releases: ((o: SaveOutcome) => void)[] = [];
    const sent: string[][] = [];
    const send = vi.fn(
      (tags: string[]) =>
        new Promise<SaveOutcome>((resolve) => {
          sent.push(tags);
          releases.push(resolve);
        }),
    );
    const settled: SaveOutcome[] = [];
    const sendTags = createLatestSender(send, (o) => settled.push(o));

    const done = sendTags(["a"]);
    void sendTags(["a", "b"]); // superseded before it is sent
    void sendTags(["a", "b", "c"]);
    expect(sent).toEqual([["a"]]); // one request at a time

    releases[0]({ ok: false, error: "old" });
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]).toEqual(["a", "b", "c"]);
    expect(settled).toEqual([]); // the stale result is not reported

    releases[1]({ ok: true });
    await done;
    expect(settled).toEqual([{ ok: true }]);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("treats a throwing send as a failure and keeps working", async () => {
    const send = vi
      .fn<(v: number) => Promise<SaveOutcome>>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue({ ok: true });
    const settled: SaveOutcome[] = [];
    const sendValue = createLatestSender(send, (o) => settled.push(o));
    await sendValue(1);
    await sendValue(2);
    expect(settled).toEqual([{ ok: false, error: SAVE_FAILED }, { ok: true }]);
  });
});
