import { describe, expect, it, vi } from "vitest";
import { formToPatch, hasListField, patchToFormData } from "@/components/fields/form-patch";
import { createSaveQueue, type SaveState } from "@/components/fields/save-queue";

describe("form patch", () => {
  it("reads every field and always returns tags as a list", () => {
    const fd = new FormData();
    fd.append("title", "제목");
    fd.append("stage", "drafting");
    fd.append("tags", "A");
    fd.append("tags", "B");
    expect(formToPatch(fd)).toEqual({ title: "제목", stage: "drafting", tags: ["A", "B"] });
    expect(formToPatch(new FormData())).toEqual({ tags: [] });
  });

  it("round-trips a patch with a presence marker for cleared lists", () => {
    const fd = patchToFormData({ body: "x", tags: [] });
    expect(fd.get("body")).toBe("x");
    expect(hasListField(fd, "tags")).toBe(true);
    expect(fd.getAll("tags")).toEqual([]);
    expect(hasListField(patchToFormData({ body: "x" }), "tags")).toBe(false);
  });
});

describe("save queue (shared copy)", () => {
  it("sends only fields that differ from the baseline", async () => {
    const save = vi.fn(async () => ({ ok: true as const }));
    const queue = createSaveQueue<Record<string, unknown>>(save, () => {});
    queue.resetBaseline({ title: "a", tags: ["x"] });
    queue.add({ title: "a", tags: ["x"] });
    await queue.flush();
    expect(save).not.toHaveBeenCalled();
    queue.add({ title: "b", tags: ["x"] });
    await queue.flush();
    expect(save).toHaveBeenCalledWith({ title: "b" });
  });

  it("keeps failed fields for the next flush and reports states", async () => {
    const states: SaveState[] = [];
    const save = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "실패" })
      .mockResolvedValueOnce({ ok: true });
    const queue = createSaveQueue<Record<string, unknown>>(save, (s) => states.push(s));
    queue.add({ title: "b" });
    await queue.flush();
    expect(queue.dirty()).toBe(true);
    await queue.flush();
    expect(save).toHaveBeenLastCalledWith({ title: "b" });
    expect(queue.dirty()).toBe(false);
    expect(states).toEqual(["pending", "saving", "error", "saving", "saved"]);
  });
});
