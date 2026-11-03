"use server";

import { revalidatePath } from "next/cache";
import { ITEM_ROUTE } from "@/lib/enums";
import { RepoError, tasks } from "@/lib/repo";
import type { Task, TaskParent } from "@/lib/repo/tasks";
import { parseId } from "./parse";
import { runAction, type ActionResult } from "./result";

const NOT_FOUND = "할 일을 찾을 수 없습니다.";
const PARENT_TYPES = new Set(["project", "goal", "area"]);

function parseParent(value: unknown): TaskParent {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") throw new RepoError("invalid", "소속 값이 올바르지 않습니다.");
  const { type, id } = value as Record<string, unknown>;
  if (typeof type !== "string" || !PARENT_TYPES.has(type)) {
    throw new RepoError("invalid", "소속 값이 올바르지 않습니다.");
  }
  return { type: type as "project" | "goal" | "area", id: parseId(id, "소속") };
}

function parseOptionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new RepoError("invalid", `${field} 값이 올바르지 않습니다.`);
  return value;
}

/** Task lists show on `/tasks`, home and the parent's page; counts sit in the layout. */
function revalidateFor(
  parent: TaskParent | { parentType: string | null; parentId: string | null },
) {
  revalidatePath("/");
  revalidatePath("/tasks");
  const p =
    parent && "parentType" in parent
      ? parent.parentType && parent.parentId
        ? { type: parent.parentType, id: parent.parentId }
        : null
      : parent;
  if (p) revalidatePath(`${ITEM_ROUTE[p.type as "project"]}/${p.id}`);
}

export async function createTask(input: {
  title: unknown;
  parent?: unknown;
  dueDate?: unknown;
}): Promise<ActionResult<Task>> {
  return runAction(async () => {
    if (typeof input?.title !== "string") throw new RepoError("invalid", "할 일을 입력하세요.");
    const parent = parseParent(input.parent);
    const task = await tasks.create({
      title: input.title,
      parent,
      dueDate: parseOptionalString(input.dueDate, "마감일"),
    });
    revalidateFor(parent);
    return task;
  });
}

/** Patch: `title`, `dueDate` (null clears), `done`. */
export async function updateTask(
  id: unknown,
  patch: { title?: unknown; dueDate?: unknown; done?: unknown },
): Promise<ActionResult<Task>> {
  return runAction(async () => {
    if (!patch || typeof patch !== "object")
      throw new RepoError("invalid", "값이 올바르지 않습니다.");
    if (patch.title !== undefined && typeof patch.title !== "string") {
      throw new RepoError("invalid", "할 일을 입력하세요.");
    }
    if (patch.done !== undefined && typeof patch.done !== "boolean") {
      throw new RepoError("invalid", "완료 값이 올바르지 않습니다.");
    }
    const task = await tasks.update(parseId(id), {
      title: patch.title as string | undefined,
      dueDate: parseOptionalString(patch.dueDate, "마감일"),
      done: patch.done as boolean | undefined,
    });
    if (!task) throw new RepoError("not_found", NOT_FOUND);
    revalidateFor(task);
    return task;
  });
}

/** One step up or down among the parent's tasks. */
export async function moveTask(id: unknown, direction: unknown): Promise<ActionResult<boolean>> {
  return runAction(async () => {
    if (direction !== "up" && direction !== "down") {
      throw new RepoError("invalid", "순서가 올바르지 않습니다.");
    }
    const taskId = parseId(id);
    const moved = await tasks.move(taskId, direction);
    const task = await tasks.get(taskId);
    if (!task) throw new RepoError("not_found", NOT_FOUND);
    revalidateFor(task);
    return moved;
  });
}

/** Deletes the task; returns it so the client can offer 되돌리기 (re-create). */
export async function deleteTask(id: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const taskId = parseId(id);
    const task = await tasks.get(taskId);
    if (!task || !(await tasks.remove(taskId))) throw new RepoError("not_found", NOT_FOUND);
    revalidateFor(task);
    return null;
  });
}

/** Undo for delete: puts the task back (new id, end of its parent's list, same state). */
export async function restoreTask(input: {
  title: unknown;
  parent?: unknown;
  dueDate?: unknown;
  done?: unknown;
}): Promise<ActionResult<Task>> {
  return runAction(async () => {
    if (typeof input?.title !== "string") throw new RepoError("invalid", "할 일을 입력하세요.");
    const parent = parseParent(input.parent);
    let task = await tasks.create({
      title: input.title,
      parent,
      dueDate: parseOptionalString(input.dueDate, "마감일"),
    });
    if (input.done === true) task = (await tasks.update(task.id, { done: true })) ?? task;
    revalidateFor(parent);
    return task;
  });
}
