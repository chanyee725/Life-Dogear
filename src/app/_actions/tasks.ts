"use server";

import { revalidatePath } from "next/cache";
import { LIST_CHANGED, resolveAnchor } from "@/lib/tasks/order";
import { RepoError, tasks } from "@/lib/repo";
import type { Task, TaskParent } from "@/lib/repo/tasks";
import { parseId } from "./parse";
import { runAction, type ActionResult } from "./result";
import { itemRoutePattern } from "@/lib/item-href";

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
  if (p) revalidatePath(itemRoutePattern(p.type as "project"), "page");
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

/**
 * Drag and drop: right after `afterId` (null = first) among same-state siblings. The order
 * may have changed on another device since the client loaded it, so the place is worked out
 * against the current order from the drop's neighbours (`beforeId` = the task it was dropped
 * above); when neither is left, it fails and the client reloads the list.
 */
export async function moveTaskAfter(
  id: unknown,
  afterId: unknown,
  beforeId: unknown = null,
): Promise<ActionResult<boolean>> {
  return runAction(async () => {
    const taskId = parseId(id);
    const after = afterId === null ? null : parseId(afterId);
    const before = beforeId === null ? null : parseId(beforeId);
    const task = await tasks.get(taskId);
    if (!task) throw new RepoError("not_found", NOT_FOUND);
    const parent: TaskParent =
      task.parentType && task.parentId ? { type: task.parentType, id: task.parentId } : null;
    const current = await tasks.list({
      parent,
      done: task.doneAt !== null,
      includeArchivedParents: true,
    });
    const anchor = resolveAnchor(
      current.map((t) => t.id),
      taskId,
      after,
      before,
    );
    if (anchor === undefined) throw new RepoError("invalid", LIST_CHANGED);
    const moved = await tasks.moveAfter(taskId, anchor);
    revalidateFor(task);
    return moved;
  });
}

/**
 * After a failed drop: revalidates the task's lists so the client reloads them in the
 * server's current order (it may have been changed on another device).
 */
export async function reloadTasks(id: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const task = await tasks.get(parseId(id));
    if (!task) throw new RepoError("not_found", NOT_FOUND);
    revalidateFor(task);
    return null;
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

/**
 * Undo for delete: puts the task back (new id) at its old place (`sortOrder`) with its old
 * completion time (`doneAt`); without `sortOrder` at the end of its parent's list.
 */
export async function restoreTask(input: {
  title: unknown;
  parent?: unknown;
  dueDate?: unknown;
  sortOrder?: unknown;
  doneAt?: unknown;
  /** Older callers: done without a known completion time (completed now). */
  done?: unknown;
}): Promise<ActionResult<Task>> {
  return runAction(async () => {
    if (typeof input?.title !== "string") throw new RepoError("invalid", "할 일을 입력하세요.");
    if (input.sortOrder !== undefined && typeof input.sortOrder !== "number") {
      throw new RepoError("invalid", "순서가 올바르지 않습니다.");
    }
    const parent = parseParent(input.parent);
    const task = await tasks.restore({
      title: input.title,
      parent,
      dueDate: parseOptionalString(input.dueDate, "마감일"),
      sortOrder: input.sortOrder,
      doneAt:
        parseOptionalString(input.doneAt, "완료") ??
        (input.done === true ? new Date().toISOString() : null),
    });
    revalidateFor(parent);
    return task;
  });
}
