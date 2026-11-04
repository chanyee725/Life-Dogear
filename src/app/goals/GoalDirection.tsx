import Link from "next/link";
import { Badge, Card, EmptyAdd } from "@/components/ui";
import { GOAL_HORIZON } from "@/lib/enums";
import type { ListGoal } from "./list-view";

/**
 * The active life goals as one card at the top of the list (no progress — life goals
 * have none). With none, the card's place holds the add action.
 */
export function GoalDirection({ goals }: { goals: readonly ListGoal[] }) {
  return (
    <section aria-label="인생 목표" className="mb-5">
      {goals.length ? (
        <Card className="flex items-start gap-3 bg-surface px-4 py-3">
          <Badge tone={GOAL_HORIZON.tone("life")} className="mt-0.5 shrink-0">
            {GOAL_HORIZON.label("life")}
          </Badge>
          <ul className="flex min-w-0 flex-col gap-1">
            {goals.map((g) => (
              <li key={g.id} className="min-w-0">
                <Link
                  href={`/goals/${g.id}`}
                  className="rounded-sm text-[15px] font-semibold break-words hover:underline"
                >
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyAdd href="/goals/new?horizon=life" className="py-3">
          ＋ 인생 목표
        </EmptyAdd>
      )}
    </section>
  );
}
