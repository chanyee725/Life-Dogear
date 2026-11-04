import { describe, expect, it, vi } from "vitest";
import { baselineFromRendered } from "@/components/fields/form-patch";
import { createSaveQueue } from "@/components/fields/save-queue";

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
    const queue = createSaveQueue<Record<string, unknown>>(async () => ({ ok: true }), () => {});
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
});
