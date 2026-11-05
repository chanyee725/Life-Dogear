import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { GOAL_HORIZON } from "@/lib/enums";
import type { ListGoal } from "./list-view";
import { itemPath } from "@/lib/item-path";

/**
 * The active life goals as one card at the top of the list (no progress — life goals
 * have none). With none, nothing: the page's '새 목표' button (or, with no goals at all,
 * its empty state) is the add action.
 */
export function GoalDirection({ goals }: { goals: readonly ListGoal[] }) {
  if (goals.length === 0) return null;
  return (
    <section aria-label="인생 목표" className="mb-5">
      <Card className="flex items-start gap-3 bg-surface px-4 py-3">
        <Badge tone={GOAL_HORIZON.tone("life")} className="mt-0.5 shrink-0">
          {GOAL_HORIZON.label("life")}
        </Badge>
        <ul className="flex min-w-0 flex-col gap-1">
          {goals.map((g) => (
            <li key={g.id} className="min-w-0">
              <Link
                href={itemPath("goals", g.id, g.title)}
                className="rounded-sm text-base font-semibold break-words hover:underline"
              >
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
