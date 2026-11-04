import Link from "next/link";
import type { ListGoal } from "./list-view";

/**
 * "방향": the active life goals, one per line and a step larger than the rows below —
 * the one thing that stands out on the page. No progress (life goals have none).
 */
export function GoalDirection({ goals }: { goals: readonly ListGoal[] }) {
  return (
    <section aria-labelledby="goal-direction" className="mb-6 flex gap-4">
      <h2 id="goal-direction" className="w-10 shrink-0 pt-1 text-[13px] text-muted">
        방향
      </h2>
      {goals.length ? (
        <ul className="flex min-w-0 flex-col gap-1">
          {goals.map((g) => (
            <li key={g.id} className="min-w-0">
              <Link
                href={`/goals/${g.id}`}
                className="rounded-sm text-base font-semibold break-words hover:underline sm:text-lg"
              >
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Link
          href="/goals/new?horizon=life"
          className="rounded-sm pt-0.5 text-sm text-accent hover:underline"
        >
          + 인생 목표
        </Link>
      )}
    </section>
  );
}
