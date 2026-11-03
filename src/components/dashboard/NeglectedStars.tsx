import Link from "next/link";
import { ITEM_TYPE } from "@/lib/enums";
import { DashboardSection } from "./DashboardSection";
import type { NeglectedStar } from "./today";

const DAY_MS = 86_400_000;

/**
 * Home "오래 손대지 않은 중요한 별": the cosmos panel's list (score ≥ 0.55, untouched 45+
 * days). Hidden when empty — it is a nudge, not a to-do.
 */
export function NeglectedStars({ stars, now }: { stars: NeglectedStar[]; now: Date }) {
  if (!stars.length) return null;
  return (
    <DashboardSection
      id="neglected-stars"
      title="오래 손대지 않은 중요한 별"
      action={
        <Link href="/graph?mode=cosmos" className="text-xs text-muted hover:text-fg">
          우주 보기
        </Link>
      }
    >
      <ul className="flex flex-col divide-y divide-border">
        {stars.map((s) => {
          const t = s.lastActiveAt ? Date.parse(s.lastActiveAt) : NaN;
          const days = Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / DAY_MS);
          return (
            <li key={`${s.type}:${s.id}`} className="flex items-baseline gap-3 py-1.5 text-sm">
              <span className="w-12 shrink-0 text-xs text-muted">{ITEM_TYPE.label(s.type)}</span>
              <Link href={s.href} className="min-w-0 flex-1 truncate text-fg hover:underline">
                {s.title}
              </Link>
              {days !== null ? (
                <span className="shrink-0 text-xs text-muted tabular-nums">{days}일 전</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </DashboardSection>
  );
}
