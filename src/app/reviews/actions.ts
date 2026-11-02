"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, parseId } from "@/app/_actions/parse";
import { runAction, type ActionResult } from "@/app/_actions/result";
import { createGoal } from "@/app/goals/actions";
import { REVIEW_KIND } from "@/lib/enums";
import { links, RepoError } from "@/lib/repo";
import * as reviews from "@/lib/repo/reviews";
import { periodOf } from "@/lib/reviews/period";
import { parseReviewForm } from "./form";
import { nextGoalTarget } from "./next-goal";

function revalidate(id?: string) {
  // Home shows the "이번 주 회고" line.
  revalidatePath("/");
  revalidatePath("/reviews");
  if (id) revalidatePath(`/reviews/${id}`);
}

/**
 * "이번 주 회고 쓰기" and friends: opens the review of `kind` + `period` (default: the
 * current period), creating it if missing — one per period — then goes to it.
 */
export async function openReview(form: FormData): Promise<void> {
  const kindValue = formText(form, "kind");
  const kind = REVIEW_KIND.is(kindValue) ? kindValue : "week";
  const result = await runAction(async () => {
    const period = formText(form, "period") || periodOf(kind, new Date());
    const { review, created } = await reviews.open(kind, period);
    if (created) revalidate(review.id);
    return review.id;
  });
  // `redirect` throws, so it stays outside runAction.
  redirect(result.ok ? `/reviews/${result.data}` : `/reviews?kind=${kind}`);
}

export async function updateReview(
  id: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const reviewId = parseId(id);
    const updated = await reviews.update(reviewId, parseReviewForm(form));
    if (!updated) throw new RepoError("not_found", "회고를 찾을 수 없습니다.");
    revalidate(reviewId);
    return { id: reviewId };
  });
}

/** 작성 완료 / 다시 쓰기. Completing refreshes the goal progress snapshot. */
export async function setReviewCompleted(
  id: unknown,
  completed: unknown,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const reviewId = parseId(id);
    if (typeof completed !== "boolean") throw new RepoError("invalid", "값이 올바르지 않습니다.");
    if (!(await reviews.update(reviewId, { completed }))) {
      throw new RepoError("not_found", "회고를 찾을 수 없습니다.");
    }
    revalidate(reviewId);
    return null;
  });
}

export async function deleteReview(id: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const reviewId = parseId(id);
    if (!(await reviews.remove(reviewId))) {
      throw new RepoError("not_found", "회고를 찾을 수 없습니다.");
    }
    revalidate(reviewId);
    return null;
  });
}

/**
 * "다음 목표 초안" in a quarter/year review: creates the next quarter's (or year's) goal
 * with the goal action, then links it to the review. Horizon and period come from the
 * review, not the form; the form sends `title` and optionally `parentId`.
 */
export async function createGoalFromReview(
  reviewId: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  const prepared = await runAction(async () => {
    const id = parseId(reviewId);
    const review = await reviews.get(id);
    if (!review) throw new RepoError("not_found", "회고를 찾을 수 없습니다.");
    const target = nextGoalTarget(review.kind, review.period);
    if (!target) throw new RepoError("invalid", "분기·연간 회고에서만 목표를 만들 수 있습니다.");
    const goalForm = new FormData();
    goalForm.set("title", formText(form, "title") ?? "");
    goalForm.set("horizon", target.horizon);
    goalForm.set("period", target.period);
    const parentId = formText(form, "parentId");
    if (parentId) goalForm.set("parentId", parentId);
    return { id, goalForm };
  });
  if (!prepared.ok) return prepared;

  const created = await createGoal(prepared.data.goalForm);
  if (!created.ok) return created;
  return runAction(async () => {
    await links.link(
      { type: "review", id: prepared.data.id },
      { type: "goal", id: created.data.id },
    );
    revalidate(prepared.data.id);
    return created.data;
  });
}
