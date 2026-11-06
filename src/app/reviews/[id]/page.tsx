import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { ArchivedNotice } from "@/components/fields/ArchiveButton";
import { DetailMoreMenu } from "@/components/fields/DetailMoreMenu";
import { DetailBody } from "@/components/fields/ItemDetail";
import { ItemForm } from "@/components/fields/ItemForm";
import { LocalGraph } from "@/components/graph/LocalGraph";
import { ConnectedItems } from "@/components/links";
import { Page } from "@/components/shell/PageHeader";
import { Badge, LinkButton } from "@/components/ui";
import { REVIEW_KIND } from "@/lib/enums";
import { itemPath } from "@/lib/item-path";
import { itemIdForMetadata, resolveItemRoute } from "@/lib/item-route";
import { goals, projects, thoughts } from "@/lib/repo";
import * as reviews from "@/lib/repo/reviews";
import { periodLabel } from "@/lib/reviews/period";
import { NextGoalForm } from "../NextGoalForm";
import { nextGoalTarget } from "../next-goal";
import { deleteReview, updateReview } from "../actions";
import { CompleteButton } from "../CompleteButton";
import { FocusPicker, type FocusOption } from "../FocusPicker";
import { staleFocusOptions } from "../focus-options";
import { KIND_TAB_LABEL } from "../labels";
import { progressChange } from "../progress";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await itemIdForMetadata("reviews", (await params).id);
  const review = id ? await reviews.get(id) : null;
  return { title: review?.title ?? "회고" };
}

function Step({ n, title, children }: { n?: number; title: string; children?: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold">
        {n ? <span className="text-muted tabular-nums">{n}.</span> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v}%`);

export default async function ReviewDetailPage({ params }: Props) {
  const id = await resolveItemRoute("reviews", (await params).id);
  const review = await reviews.get(id);
  if (!review) notFound();

  const isWeek = review.kind === "week";
  const target = nextGoalTarget(review.kind, review.period);
  const [periodGoals, previous, inboxCount, stageColumns, general, parentCandidates] =
    await Promise.all([
      reviews.goalsForPeriod(review.kind, review.period),
      reviews.findPrevious(review),
      isWeek ? thoughts.countInbox() : Promise.resolve(0),
      isWeek ? projects.listByStage() : Promise.resolve([]),
      isWeek ? projects.listActiveGeneral() : Promise.resolve([]),
      target ? goals.list({ horizon: target.parentHorizon }) : Promise.resolve([]),
    ]);
  const parents = target
    ? parentCandidates
        .filter((g) => g.period === target.parentPeriod)
        .map((g) => ({ id: g.id, title: g.title }))
    : [];
  const activeProjects = [...stageColumns.flatMap((c) => c.items), ...general];
  const ref = { type: "review" as const, id: review.id };
  const backHref = review.kind === "week" ? "/reviews" : `/reviews?kind=${review.kind}`;

  const choices: FocusOption[] = [
    ...periodGoals
      .filter((g) => g.horizon === "quarter")
      .map((g) => ({ key: `goal:${g.id}`, label: g.title, hint: "목표" })),
    ...activeProjects.map((p) => ({ key: `project:${p.id}`, label: p.title, hint: "프로젝트" })),
  ];
  // Saved picks that dropped out (done, archived, deleted) come first so they can be cleared.
  const focusOptions = [...(await staleFocusOptions(review.focus, choices)), ...choices];

  const goalCheck = (
    <Step n={isWeek ? 3 : undefined} title="목표 점검">
      {periodGoals.length ? (
        <ul className="flex flex-col gap-1 text-sm">
          {periodGoals.map((g) => {
            const now = review.goalProgress[g.id];
            const change = progressChange(now, previous?.goalProgress[g.id]);
            return (
              <li key={g.id} className="flex items-baseline gap-2">
                <Link
                  href={itemPath("goals", g.id, g.title)}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {g.title}
                </Link>
                <span className="text-xs text-muted">{g.period}</span>
                <span className="w-12 text-right tabular-nums">{pct(now)}</span>
                <span
                  className="w-12 text-right text-xs text-muted tabular-nums"
                  title="지난 회고 대비"
                >
                  {change}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <LinkButton href="/goals" variant="ghost" size="sm" className="self-start">
          목표 보기
        </LinkButton>
      )}
    </Step>
  );

  return (
    <Page className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        {review.archivedAt ? <ArchivedNotice item={ref} /> : null}
        <ItemForm
          mode="edit"
          action={updateReview.bind(null, review.id)}
          basePath="/reviews"
          backLabel="회고"
          actions={
            <>
              <CompleteButton id={review.id} completed={review.completedAt !== null} />
              <DetailMoreMenu
                item={ref}
                archived={Boolean(review.archivedAt)}
                redirectTo={backHref}
                deleteAction={deleteReview.bind(null, review.id)}
                itemLabel="이 회고"
              />
            </>
          }
        >
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {periodLabel(review.kind, review.period)}
            </h1>
            <div className="flex items-center gap-2">
              <Badge tone={REVIEW_KIND.tone(review.kind)}>{KIND_TAB_LABEL[review.kind]} 회고</Badge>
              {review.completedAt ? (
                <Badge tone="green">완료</Badge>
              ) : (
                <Badge tone="gray">작성 중</Badge>
              )}
            </div>
          </div>

          {isWeek ? (
            <>
              <Step n={1} title="수집함 비우기">
                {inboxCount ? (
                  <p className="text-sm">
                    <Link href="/inbox" className="hover:underline">
                      정리할 항목 <span className="font-medium tabular-nums">{inboxCount}</span>개 →
                    </Link>
                  </p>
                ) : (
                  <LinkButton href="/inbox" variant="ghost" size="sm" className="self-start">
                    수집함 보기
                  </LinkButton>
                )}
              </Step>
              <Step n={2} title="프로젝트 점검">
                {activeProjects.length ? (
                  <ul className="flex flex-col gap-1 text-sm">
                    {activeProjects.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={itemPath("projects", p.id, p.title)}
                          className="hover:underline"
                        >
                          {p.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <LinkButton href="/projects" variant="ghost" size="sm" className="self-start">
                    프로젝트 보기
                  </LinkButton>
                )}
              </Step>
              {goalCheck}
              <Step n={4} title="다음 주 집중 3가지">
                <FocusPicker
                  options={focusOptions}
                  defaultValue={review.focus.map((f) => `${f.type}:${f.id}`)}
                />
              </Step>
            </>
          ) : (
            goalCheck
          )}

          <DetailBody>
            <MarkdownEditor
              key={review.id}
              doc={{ type: "review", id: review.id }}
              name="body"
              value={review.body}
              placeholder="돌아보며 적어 보세요…"
            />
          </DetailBody>
        </ItemForm>
      </div>
      {target ? (
        <Step title={review.kind === "quarter" ? "다음 분기 목표 만들기" : "내년 연 목표 만들기"}>
          <NextGoalForm
            reviewId={review.id}
            targetLabel={`${periodLabel(target.horizon, target.period)} 목표`}
            parents={parents}
          />
        </Step>
      ) : null}
      <ConnectedItems item={ref} />
      <LocalGraph node={`review:${review.id}`} />
    </Page>
  );
}
