// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/lib/repo/tasks";

const updateTask = vi.fn();
vi.mock("@/app/_actions/tasks", () => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  moveTask: vi.fn(),
  moveTaskAfter: vi.fn(),
  reloadTasks: vi.fn(),
  restoreTask: vi.fn(),
  updateTask: (...args: unknown[]) => updateTask(...args),
}));
import { HomeTodo, TodayTaskList } from "@/components/dashboard/HomeTodo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = "2026-11-03";
const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: `할 일 ${id}`,
  doneAt: null,
  dueDate: TODAY,
  parentType: null,
  parentId: null,
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",

  ...extra,
});

let root: Root | undefined;
let host: HTMLDivElement | undefined;
beforeEach(() => updateTask.mockReset());
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
});

/** Home Todo with 지남 `late`, 오늘 `due`, and `later` (due next week) finished today. */
async function setup(hidden = 0) {
  const tasks = [
    task("late", { dueDate: "2026-11-01" }),
    task("due"),
    task("later", { dueDate: "2026-11-10", doneAt: `${TODAY}T01:00:00.000Z` }),
  ];
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const list = createElement(TodayTaskList, { tasks, today: TODAY, hidden, doneOpen: true });
  await act(async () => root!.render(createElement(HomeTodo, { count: 2 + hidden, today: list })));
  const button = () => host!.querySelector<HTMLButtonElement>("button[aria-haspopup]")!;
  await act(async () => button().click());
  const box = (title: string) =>
    document.querySelector<HTMLInputElement>(`input[aria-label="완료: 할 일 ${title}"]`)!;
  const name = () => button().getAttribute("aria-label");
  return { box, name };
}

const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

describe("home Todo badge follows the list", () => {
  it("counts the list's open 지남 + 오늘 tasks plus the ones past the cap", async () => {
    const t = await setup(3);
    expect(t.name()).toBe("할 일 5개");
  });

  it("drops at once on a check and comes back when the save fails (rollback)", async () => {
    let fail!: () => void;
    updateTask.mockReturnValue(
      new Promise((resolve) => {
        fail = () => resolve({ ok: false, error: "저장하지 못했습니다." });
      }),
    );
    const t = await setup();
    expect(t.name()).toBe("할 일 2개");
    await act(async () => t.box("due").click());
    expect(t.name()).toBe("할 일 1개");
    await act(async () => fail());
    await settle();
    expect(updateTask).toHaveBeenCalledWith("due", { done: true });
    expect(t.name()).toBe("할 일 2개");
  });

  it("does not count a task finished today that is due later once it is unchecked", async () => {
    updateTask.mockResolvedValue({ ok: true, data: null });
    const t = await setup();
    await act(async () => t.box("later").click());
    await settle();
    expect(updateTask).toHaveBeenCalledWith("later", { done: false });
    expect(t.box("later").checked).toBe(false);
    expect(t.name()).toBe("할 일 2개");
    // A check elsewhere still counts down from the right number.
    await act(async () => t.box("late").click());
    await settle();
    expect(t.name()).toBe("할 일 1개");
  });

  it("takes a new server count when the list empties (and so stops reporting)", async () => {
    updateTask.mockResolvedValue({ ok: true, data: null });
    const t = await setup();
    await act(async () => t.box("late").click());
    await settle();
    expect(t.name()).toBe("할 일 1개");
    const empty = createElement("p", null, "오늘 할 일이 없습니다.");
    await act(async () => root!.render(createElement(HomeTodo, { count: 0, today: empty })));
    expect(t.name()).toBe("할 일 0개");
    expect(document.querySelector('[data-testid="todo-count"]')).toBeNull();
  });

  it("takes the server count on a new render even when the count is unchanged", async () => {
    let save!: () => void;
    updateTask.mockReturnValue(
      new Promise((resolve) => (save = () => resolve({ ok: true, data: null }))),
    );
    const t = await setup();
    await act(async () => t.box("late").click());
    expect(t.name()).toBe("할 일 1개");
    // The server's next render has the same count but no list, so nothing reports again.
    const empty = createElement("p", null, "오늘 할 일이 없습니다.");
    await act(async () => root!.render(createElement(HomeTodo, { count: 2, today: empty })));
    expect(t.name()).toBe("할 일 2개");
    await act(async () => save());
  });
});
