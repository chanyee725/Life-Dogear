import Link from "next/link";
import { Badge, Section } from "@/components/ui";
import { ITEM_TYPE } from "@/lib/enums";
import type { RevisitStar } from "./today";

const DAY_MS = 86_400_000;

/** Home "다시 볼 별" (4.4): important items untouched for long. Hidden when empty. */
export function RevisitStars({ stars, now }: { stars: RevisitStar[]; now: Date }) {
  if (!stars.length) return null;
  return (
    <Section id="revisit-stars" title="다시 볼 별">
      <ul className="flex flex-col">
        {stars.map((s) => {
          const t = s.lastActiveAt ? Date.parse(s.lastActiveAt) : NaN;
          const days = Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / DAY_MS);
          return (
            <li key={`${s.type}:${s.id}`} className="flex h-9 items-center gap-2">
              <Badge tone={ITEM_TYPE.tone(s.type)}>{ITEM_TYPE.label(s.type)}</Badge>
              <Link
                href={s.href}
                className="min-w-0 flex-1 truncate text-sm text-fg hover:underline"
              >
                {s.title}
              </Link>
              {days !== null ? (
                <span className="text-xs text-muted tabular-nums">{days}일 전</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
