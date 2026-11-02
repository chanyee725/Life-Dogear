import Link from "next/link";
import { Badge } from "@/components/ui";
import { SEMINAR_KIND, THOUGHT_KIND, THOUGHT_MATURITY } from "@/lib/enums";
import type { Seminar } from "@/lib/repo/seminars";
import type { Thought } from "@/lib/repo/thoughts";
import { DashboardEmpty, DashboardSection } from "./DashboardSection";
import { formatDate, formatRelative } from "./format";

const rowClass =
  "flex flex-col gap-1 rounded-md px-3 py-2.5 transition-colors hover:bg-surface focus-visible:bg-surface";

const moreLink = (href: string) => (
  <Link href={href} className="text-xs text-muted hover:text-fg">
    모두 보기
  </Link>
);

export function RecentThoughts({ thoughts }: { thoughts: Thought[] }) {
  return (
    <DashboardSection id="recent-thoughts" title="최근 생각" action={moreLink("/thoughts")}>
      {thoughts.length === 0 ? (
        <DashboardEmpty>
          아직 생각이 없습니다. 위 빠른 입력에 적고 Enter를 눌러 보세요.
        </DashboardEmpty>
      ) : (
        <ul className="-mx-3 flex flex-col">
          {thoughts.map((t) => (
            <li key={t.id}>
              <Link href={`/thoughts/${t.id}`} className={rowClass}>
                <span className="line-clamp-1 text-sm text-fg">{t.title}</span>
                <span className="flex items-center gap-1.5 text-xs text-faint">
                  <Badge tone={THOUGHT_KIND.tone(t.kind)}>{THOUGHT_KIND.label(t.kind)}</Badge>
                  <Badge tone={THOUGHT_MATURITY.tone(t.maturity)}>
                    {THOUGHT_MATURITY.label(t.maturity)}
                  </Badge>
                  {formatRelative(t.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

export function RecentSeminars({ seminars }: { seminars: Seminar[] }) {
  return (
    <DashboardSection id="recent-seminars" title="최근 세미나" action={moreLink("/seminars")}>
      {seminars.length === 0 ? (
        <DashboardEmpty>아직 세미나 기록이 없습니다.</DashboardEmpty>
      ) : (
        <ul className="-mx-3 flex flex-col">
          {seminars.map((s) => (
            <li key={s.id}>
              <Link href={`/seminars/${s.id}`} className={rowClass}>
                <span className="line-clamp-1 text-sm text-fg">{s.title}</span>
                <span className="flex items-center gap-1.5 text-xs text-faint">
                  <Badge tone={SEMINAR_KIND.tone(s.kind)}>{SEMINAR_KIND.label(s.kind)}</Badge>
                  {[formatDate(s.date), s.speaker].filter(Boolean).join(" · ")}
                </span>
                {s.keyLine ? (
                  <span className="line-clamp-1 text-xs text-muted">{s.keyLine}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
