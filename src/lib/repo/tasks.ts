/**
 * TEMPORARY STUB (구현자 B): same signatures as PLAN-TODAY 4절 so the today screen and
 * the review draft can be built before 구현자 A's real module lands. Replaced wholesale
 * by A's `tasks.ts` on merge — do not extend.
 */
export type TaskParentType = "project" | "goal" | "area";
export type TaskParent = { type: TaskParentType; id: string } | null;

export type Task = {
  id: string;
  title: string;
  doneAt: string | null;
  dueDate: string | null;
  parentType: TaskParentType | null;
  parentId: string | null;
  parentTitle?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export async function list(_opts?: {
  parent?: TaskParent;
  done?: boolean;
  dueBefore?: string;
  dueFrom?: string;
  includeArchivedParents?: boolean;
}): Promise<Task[]> {
  return [];
}

export async function listToday(_today: string): Promise<{ today: Task[]; overdue: Task[] }> {
  return { today: [], overdue: [] };
}

export async function listThisWeek(_from: string, _to: string): Promise<Task[]> {
  return [];
}

export async function listCompletedBetween(_from: string, _to: string): Promise<Task[]> {
  return [];
}

export async function countFor(
  _parents: TaskParent[],
): Promise<Record<string, { done: number; total: number }>> {
  return {};
}
