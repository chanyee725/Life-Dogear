import { describe, expect, it } from "vitest";
import { applyDrop, dropSlot, placeInOrder } from "@/components/tasks/reorder";

describe("task drag ordering", () => {
  it("finds the slot from the other rows' middles", () => {
    const mids = [18, 54, 90];
    expect(dropSlot(mids, 0)).toBe(0);
    expect(dropSlot(mids, 18)).toBe(0);
    expect(dropSlot(mids, 19)).toBe(1);
    expect(dropSlot(mids, 70)).toBe(2);
    expect(dropSlot(mids, 500)).toBe(3);
    expect(dropSlot([], 10)).toBe(0);
  });

  it("moves a task and names the one it follows", () => {
    const ids = ["a", "b", "c", "d"];
    expect(applyDrop(ids, "a", 2)).toEqual({ order: ["b", "c", "a", "d"], afterId: "c" });
    expect(applyDrop(ids, "d", 0)).toEqual({ order: ["d", "a", "b", "c"], afterId: null });
    expect(applyDrop(ids, "b", 9)).toEqual({ order: ["a", "c", "d", "b"], afterId: "d" });
    // Dropped where it already was, or unknown: nothing to do.
    expect(applyDrop(ids, "b", 1)).toBeNull();
    expect(applyDrop(ids, "x", 0)).toBeNull();
  });

  it("puts members in their new order and leaves the rest in place", () => {
    const list = ["a", "done", "b", "c"].map((id) => ({ id }));
    expect(placeInOrder(list, ["c", "a", "b"]).map((t) => t.id)).toEqual(["c", "done", "a", "b"]);
  });
});
