import { describe, expect, it, vi } from "vitest";
import { baselineFromRendered } from "@/components/fields/form-patch";
import { createHeldBaseline, createSaveQueue } from "@/components/fields/save-queue";

describe("baselineFromRendered", () => {
  it("keeps the read form as the baseline when nothing was typed before hydration", () => {
    const patch = { title: "논문", why: "", tags: ["a"] };
    const fields = [
      { name: "title", value: "논문", defaultValue: "논문" },
      { name: "why", value: "", defaultValue: "" },
    ];
    expect(baselineFromRendered(patch, fields)).toEqual({ baseline: patch, edited: false });
  });

  it("puts the rendered value back for fields typed into before hydration", () => {
    const patch = { title: "새 제목", why: "그대로" };
    const fields = [
      { name: "title", value: "새 제목", defaultValue: "옛 제목" },
      { name: "why", value: "그대로", defaultValue: "그대로" },
    ];
    expect(baselineFromRendered(patch, fields)).toEqual({
      baseline: { title: "옛 제목", why: "그대로" },
      edited: true,
    });
  });

  it("ignores unnamed fields and fields not in the patch (lists, files)", () => {
    const patch = { tags: ["a"] };
    const fields = [
      { name: "", value: "x", defaultValue: "" },
      { name: "tags", value: "draft", defaultValue: "" },
      { name: "other", value: "x", defaultValue: "" },
    ];
    expect(baselineFromRendered(patch, fields)).toEqual({ baseline: patch, edited: false });
  });

  it("doesn't count the line breaks a single-line input drops as an edit", async () => {
    // The browser strips line breaks from an input's value, never from its defaultValue.
    const patch = { title: "첫 줄둘째 줄" };
    const fields = [
      { name: "title", value: "첫 줄둘째 줄", defaultValue: "첫 줄\n둘째 줄", singleLine: true },
    ];
    const { baseline, edited } = baselineFromRendered(patch, fields);
    expect(edited).toBe(false);

    const save = vi.fn(async () => ({ ok: true as const }));
    const queue = createSaveQueue<Record<string, unknown>>(save, () => {});
    queue.resetBaseline(baseline);
    queue.add(patch);
    await queue.flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("re-read on editor ready keeps the re-serialised body out of the pre-hydration save", () => {
    const fields = (title: string) => [
      { name: "title", value: title, defaultValue: "옛 제목", singleLine: true },
      { name: "why", value: "", defaultValue: "" },
    ];
    const queue = createSaveQueue<Record<string, unknown>>(
      async () => ({ ok: true }),
      () => {},
    );
    // Mount: the editor hasn't loaded yet, so the hidden body still holds the raw server text.
    const onMount = { title: "새 제목", why: "", body: "server *body*" };
    queue.resetBaseline(baselineFromRendered(onMount, fields("새 제목")).baseline);
    // Editor ready: it re-serialised the body; the baseline is re-read around the title.
    const onReady = { title: "새 제목", why: "", body: "server _body_" };
    expect(queue.resetBaseline(baselineFromRendered(onReady, fields("새 제목")).baseline)).toBe(
      true,
    );
    // Debounced autosave read.
    queue.add(onReady);
    expect(queue.pending()).toEqual({ title: "새 제목" });
  });

  it("holds the editor body from a ready that arrives mid-save out of the next save", async () => {
    let finish = () => {};
    const save = vi.fn<(patch: Record<string, unknown>) => Promise<{ ok: true }>>(
      () => new Promise((resolve) => (finish = () => resolve({ ok: true }))),
    );
    const queue = createSaveQueue<Record<string, unknown>>(save, () => {});
    const ready = createHeldBaseline(queue, "body");
    queue.resetBaseline({ title: "옛 제목", body: "server *body*" });

    // A title save is in flight when the editor reports ready with a re-serialised body.
    queue.add({ title: "새 제목", body: "server *body*" });
    const flushing = queue.flush();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    ready.offer({ title: "새 제목", body: "server _body_" });
    finish();
    await flushing;
    ready.settle();

    queue.add({ title: "새 제목 2", body: "server _body_" });
    const next = queue.flush();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    finish();
    await next;
    expect(save.mock.calls.map(([patch]) => patch)).toEqual([
      { title: "새 제목" },
      { title: "새 제목 2" },
    ]);
  });

  it("drops the held ready body once the user's own body is queued", async () => {
    const finishers: (() => void)[] = [];
    const save = vi.fn<(patch: Record<string, unknown>) => Promise<{ ok: true }>>(
      () => new Promise((resolve) => finishers.push(() => resolve({ ok: true }))),
    );
    const queue = createSaveQueue<Record<string, unknown>>(save, () => {});
    const ready = createHeldBaseline(queue, "body");
    // Mirrors ItemForm's readIntoQueue: queue the read, then drop a stale held body.
    const readIntoQueue = (patch: Record<string, unknown>) => {
      queue.add(patch);
      if ("body" in queue.pending()) ready.drop();
      const flushed = queue.flush();
      return flushed.then(() => ready.settle());
    };
    queue.resetBaseline({ title: "옛 제목", body: "orig" });

    // 1) Title save A is in flight when the editor reports ready: the body is held.
    const a = readIntoQueue({ title: "새 제목", body: "orig" });
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    ready.offer({ title: "새 제목", body: "orig-norm" });
    // 2) The user edits the body; flush B waits behind A.
    const b = readIntoQueue({ title: "새 제목", body: "USER EDIT" });
    // 3) A ends (settle refused: B is pending). 4) B saves the user's body. 5) settle again.
    finishers[0]();
    await a;
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    finishers[1]();
    await b;

    // 6) Undo back to the editor's original body: that is a change and must be saved.
    const c = readIntoQueue({ title: "새 제목", body: "orig-norm" });
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    finishers[2]();
    await c;
    expect(save.mock.calls.map(([patch]) => patch)).toEqual([
      { title: "새 제목" },
      { body: "USER EDIT" },
      { body: "orig-norm" },
    ]);
  });
});
