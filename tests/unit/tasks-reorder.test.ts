import { describe, expect, it } from "vitest";
import { applyDrop, dragPosition, dropSlot, placeInOrder } from "@/components/tasks/reorder";
import { resolveAnchor } from "@/lib/tasks/order";

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
    expect(applyDrop(ids, "a", 2)).toEqual({
      order: ["b", "c", "a", "d"],
      afterId: "c",
      beforeId: "d",
    });
    expect(applyDrop(ids, "d", 0)).toEqual({
      order: ["d", "a", "b", "c"],
      afterId: null,
      beforeId: "a",
    });
    expect(applyDrop(ids, "b", 9)).toEqual({
      order: ["a", "c", "d", "b"],
      afterId: "d",
      beforeId: null,
    });
    // Dropped where it already was, or unknown: nothing to do.
    expect(applyDrop(ids, "b", 1)).toBeNull();
    expect(applyDrop(ids, "x", 0)).toBeNull();
  });

  it("puts members in their new order and leaves the rest in place", () => {
    const list = ["a", "done", "b", "c"].map((id) => ({ id }));
    expect(placeInOrder(list, ["c", "a", "b"]).map((t) => t.id)).toEqual(["c", "done", "a", "b"]);
  });

  it("keeps the drop slot right when the page scrolls during a drag", () => {
    // Pressed 10px into the list; other rows' middles at 18, 54, 90 (list px).
    const start = { startY: 10, mids: [18, 54, 90] };
    // List top at 100 on screen: pointer at 160 is 60px into the list.
    expect(dragPosition(start, 160, 100)).toEqual({ dy: 50, slot: 2 });
    // Page scrolled 40px down with the pointer still: the list moved up under it.
    expect(dragPosition(start, 160, 60)).toEqual({ dy: 90, slot: 3 });
    // Viewport-only geometry would still say slot 2 here.
  });

  it("places a drop by its neighbours in the current server order", () => {
    // Same as the client saw.
    expect(resolveAnchor(["a", "b", "c"], "c", "a", "b")).toBe("a");
    expect(resolveAnchor(["a", "b", "c"], "c", null, "a")).toBeNull();
    // Another device moved things around: still right after the same task.
    expect(resolveAnchor(["b", "x", "a", "c"], "c", "a", "b")).toBe("a");
    // The task it followed is gone: right before the one it was dropped above.
    expect(resolveAnchor(["b", "y", "c"], "c", "a", "y")).toBe("b");
    expect(resolveAnchor(["y", "c"], "c", "a", "y")).toBeNull();
    // Dropped last and its neighbour is gone: still last.
    expect(resolveAnchor(["b", "c", "z"], "c", "a", null)).toBe("z");
    // Both neighbours gone: cannot place it, the client reloads.
    expect(resolveAnchor(["b", "c"], "c", "a", "y")).toBeUndefined();
  });
});
