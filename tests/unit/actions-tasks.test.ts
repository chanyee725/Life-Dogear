import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from "next/cache";
import {
  createTask,
  deleteTask,
  moveTask,
  moveTaskAfter,
  reloadTasks,
  restoreTask,
  updateTask,
} from "@/app/_actions/tasks";
import { projects, tasks } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
  vi.mocked(revalidatePath).mockClear();
});

const paths = () => vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);

describe("task actions", () => {
  it("creates, updates, moves and deletes, revalidating the parent page", async () => {
    const p = await projects.create({ title: "p" });
    const parent = { type: "project", id: p.id };
    const a = await createTask({ title: "a", parent, dueDate: "2026-11-03" });
    expect(a.ok && a.data).toMatchObject({ title: "a", parentTitle: "p", dueDate: "2026-11-03" });
    expect(paths()).toEqual(["/", "/tasks", `/projects/${p.id}`]);
    const b = await createTask({ title: "b", parent });
    const bId = b.ok ? b.data.id : "";
    const aId = a.ok ? a.data.id : "";

    expect(await moveTask(bId, "up")).toEqual({ ok: true, data: true });
    expect(
      (await tasks.list({ parent: { type: "project", id: p.id } })).map((t) => t.title),
    ).toEqual(["b", "a"]);

    const done = await updateTask(aId, { done: true, dueDate: null });
    expect(done.ok && done.data.doneAt).toBeTruthy();
    expect(done.ok && done.data.dueDate).toBeNull();

    expect(await deleteTask(aId)).toEqual({ ok: true, data: null });
    expect(await deleteTask(aId)).toMatchObject({ ok: false });
    const back = await restoreTask({ title: "a", parent, done: true });
    expect(back.ok && back.data.doneAt).toBeTruthy();
  });

  it("drops after a sibling and restores at the old place", async () => {
    const p = await projects.create({ title: "p" });
    const parent = { type: "project", id: p.id } as const;
    const ids: string[] = [];
    for (const title of ["a", "b", "c"]) {
      const r = await createTask({ title, parent });
      ids.push(r.ok ? r.data.id : "");
    }
    const order = async () => (await tasks.list({ parent })).map((t) => t.title);
    expect(await moveTaskAfter(ids[0], ids[2])).toEqual({ ok: true, data: true });
    expect(await order()).toEqual(["b", "c", "a"]);
    expect(await moveTaskAfter(ids[0], "not an id")).toMatchObject({ ok: false });
    expect(await moveTaskAfter("seed-x", null)).toMatchObject({ ok: false });

    const b = (await tasks.get(ids[1]!))!;
    await deleteTask(b.id);
    const doneAt = "2026-10-01T00:00:00.000Z";
    const back = await restoreTask({ title: "b", parent, sortOrder: b.sortOrder, doneAt });
    expect(back.ok && back.data.doneAt).toBe(doneAt);
    expect(await order()).toEqual(["b", "c", "a"]);
    expect(await restoreTask({ title: "x", sortOrder: "1" })).toMatchObject({ ok: false });
  });

  it("places a drop by its neighbours when another device changed the list", async () => {
    const p = await projects.create({ title: "p" });
    const parent = { type: "project", id: p.id } as const;
    const ids: string[] = [];
    for (const title of ["a", "b", "c", "d"]) {
      const r = await createTask({ title, parent });
      ids.push(r.ok ? r.data.id : "");
    }
    const [a, b, c, d] = ids as [string, string, string, string];
    const order = async () => (await tasks.list({ parent })).map((t) => t.title);
    // Client saw a b c d and dropped d between b and c; elsewhere b was deleted meanwhile.
    await tasks.remove(b);
    expect(await moveTaskAfter(d, b, c)).toEqual({ ok: true, data: true });
    expect(await order()).toEqual(["a", "d", "c"]);
    // Both neighbours gone: refused, so the client reloads.
    await tasks.remove(c);
    expect(await moveTaskAfter(a, b, c)).toMatchObject({ ok: false });
    expect(await order()).toEqual(["a", "d"]);
    // The client then asks for a reload of that list.
    vi.mocked(revalidatePath).mockClear();
    expect(await reloadTasks(a)).toEqual({ ok: true, data: null });
    expect(paths()).toContain(`/projects/${p.id}`);
    expect(await reloadTasks("seed-x")).toMatchObject({ ok: false });
  });

  it("rejects bad input with Korean messages", async () => {
    expect(await createTask({ title: 3 })).toMatchObject({ ok: false });
    expect(await createTask({ title: "x", parent: { type: "paper", id: "seed-1" } })).toMatchObject(
      { ok: false, error: "소속 값이 올바르지 않습니다." },
    );
    expect(await createTask({ title: "x", dueDate: 5 })).toMatchObject({ ok: false });
    expect(await updateTask("not an id", { done: true })).toMatchObject({ ok: false });
    expect(await moveTask("seed-x", "left")).toMatchObject({ ok: false });
    const inbox = await createTask({ title: "수집함" });
    expect(inbox.ok && inbox.data.parentType).toBeNull();
    expect(paths()).toEqual(["/", "/tasks"]);
  });
});
