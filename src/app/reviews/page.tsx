import type { Metadata } from "next";
import Link from "next/link";
import { firstParam, type QueryParams } from "@/components/list/query";
import { LinkTabs } from "@/components/ui/Tabs";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelative } from "@/components/ui/format";
import { REVIEW_KIND } from "@/lib/enums";
import * as reviews from "@/lib/repo/reviews";
import { periodLabel, periodOf } from "@/lib/reviews/period";
import { openReview } from "./actions";
import { bodyPreview, CURRENT_PERIOD_LABEL, KIND_TAB_LABEL } from "./labels";

export const metadata: Metadata = { title: "회고" };
export const dynamic = "force-dynamic";

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const kindParam = firstParam(params, "kind");
  const kind = REVIEW_KIND.is(kindParam) ? kindParam : "week";

  const currentPeriod = periodOf(kind, new Date());
  // Archived reviews count too (as on home): a period never gets a second review.
  const [all, current] = await Promise.all([
    reviews.list(),
    reviews.findByPeriod(kind, currentPeriod),
  ]);
  const items = all.filter((r) => r.kind === kind);
  const currentLabel = `${CURRENT_PERIOD_LABEL[kind]} 회고`;

  // One review per period: write it when missing, otherwise open the existing one.
  const primary = current ? (
    <Link href={`/reviews/${current.id}`} className={buttonClass("secondary")}>
      {currentLabel} 열기
    </Link>
  ) : (
    <form action={openReview}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="period" value={currentPeriod} />
      <Button type="submit" variant="primary">
        {currentLabel} 쓰기
      </Button>
    </form>
  );

  return (
    <Page>
      <PageHeader title="회고" actions={primary} />
      <LinkTabs
        ariaLabel="회고 기간"
        active={kind}
        className="mb-6"
        tabs={REVIEW_KIND.values.map((k) => ({
          value: k,
          label: KIND_TAB_LABEL[k],
          href: k === "week" ? "/reviews" : `/reviews?kind=${k}`,
          count: all.filter((r) => r.kind === k).length,
        }))}
      />
      {items.length ? (
        <ol
          className="flex flex-col divide-y divide-border"
          aria-label={`${KIND_TAB_LABEL[kind]} 회고 목록`}
        >
          {items.map((r) => (
            <li key={r.id}>
              <Link
                href={`/reviews/${r.id}`}
                className="flex items-baseline gap-3 rounded-md px-2 py-3 hover:bg-hover"
              >
                <span className="shrink-0 font-medium tabular-nums">
                  {periodLabel(r.kind, r.period)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                  {bodyPreview(r.body)}
                </span>
                {r.completedAt ? (
                  <Badge tone="green">완료</Badge>
                ) : (
                  <Badge tone="gray">작성 중</Badge>
                )}
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {formatRelative(r.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title={`아직 ${KIND_TAB_LABEL[kind]} 회고가 없습니다`} />
      )}
    </Page>
  );
}
