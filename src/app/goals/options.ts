import type { GoalHorizon } from "@/lib/enums";
import type { ParentOption } from "./GoalFields";

type GoalLike = {
  id: string;
  title: string;
  horizon: GoalHorizon;
  period: string | null;
  archivedAt: string | null;
};

const labelFor = (g: GoalLike) =>
  `${g.period ? `${g.period} · ` : ""}${g.title}${g.archivedAt ? " (보관됨)" : ""}`;

/**
 * Parent choices for a goal form: life and year goals (quarter goals are never parents),
 * not the goal itself, archived ones only when they are the current parent.
 */
export function parentOptionsFor(
  all: readonly GoalLike[],
  self: string | null,
  currentParent: string | null,
): ParentOption[] {
  return all
    .filter((g) => g.horizon !== "quarter" && g.id !== self)
    .filter((g) => !g.archivedAt || g.id === currentParent)
    .map((g) => ({ value: g.id, label: labelFor(g), horizon: g.horizon }));
}

/** Goal select options for projects; keeps the current goal even if archived. */
export function goalOptionsFor(
  all: readonly GoalLike[],
  current: string | null,
): { value: string; label: string }[] {
  return all
    .filter((g) => !g.archivedAt || g.id === current)
    .map((g) => ({ value: g.id, label: labelFor(g) }));
}
