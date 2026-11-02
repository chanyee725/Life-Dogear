import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { goals as goalsTable, reviews } from "@/db/schema";
import { ITEM_TYPE, REVIEW_KIND, type ReviewKind } from "@/lib/enums";
import { isValidItemId } from "@/lib/ids";
import { goalPeriodsFor, isValidPeriod, reviewTitle, shiftPeriod } from "@/lib/reviews/period";
import { reviewTemplate } from "@/lib/reviews/templates";
import { progressFor } from "./goals";
import { removeLinksFor } from "./links";
import {
  archiveFilter,
  db,
  newId,
  nowIso,
  RepoError,
  requireEnum,
  withTx,
  type ArchiveOptions,
  type Executor,
  type ItemRef,
} from "./shared";
import { removeTagsFor } from "./tags";

type Row = typeof reviews.$inferSelect;

/** Goal id → progress 0..100 (null: no progress, e.g. life goals) at writing time. */
export type GoalProgressSnapshot = Record<string, number | null>;

export type Review = Omit<Row, "focus" | "goalProgress"> & {
  /** Weekly "다음 주 집중 3가지". */
  focus: ItemRef[];
  goalProgress: GoalProgressSnapshot;
};

export const MAX_FOCUS = 3;

const ref = (id: string): ItemRef => ({ type: "review", id });

function parseJson<T>(text: string, fallback: T, valid: (v: unknown) => v is T): T {
  try {
    const value: unknown = JSON.parse(text);
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

const isRef = (r: unknown): r is ItemRef =>
  typeof r === "object" &&
  r !== null &&
  ITEM_TYPE.is((r as ItemRef).type) &&
  isValidItemId((r as ItemRef).id);

const isRefList = (v: unknown): v is ItemRef[] => Array.isArray(v) && v.every(isRef);

const isSnapshot = (v: unknown): v is GoalProgressSnapshot =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  Object.values(v).every((p) => p === null || typeof p === "number");

function toReview(row: Row): Review {
  return {
    ...row,
    focus: parseJson(row.focus, [], isRefList),
    goalProgress: parseJson(row.goalProgress, {}, isSnapshot),
  };
}

/** Validates and de-duplicates focus refs (≤ 3). */
export function normalizeFocus(value: readonly unknown[]): ItemRef[] {
  const out: ItemRef[] = [];
  const seen = new Set<string>();
  for (const r of value) {
    if (!isRef(r)) throw new RepoError("invalid", "집중할 항목이 올바르지 않습니다.");
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: r.type, id: r.id });
  }
  if (out.length > MAX_FOCUS) {
    throw new RepoError("invalid", `집중할 항목은 ${MAX_FOCUS}개까지 고를 수 있습니다.`);
  }
  return out;
}

function requirePeriod(kind: ReviewKind, period: unknown): string {
  if (!isValidPeriod(kind, period)) throw new RepoError("invalid", "기간 값이 올바르지 않습니다.");
  return period;
}

export type ReviewListOptions = ArchiveOptions & { kind?: ReviewKind };

/** Newest period first; non-archived by default. */
export async function list(options: ReviewListOptions = {}): Promise<Review[]> {
  const rows = await db()
    .select()
    .from(reviews)
    .where(
      and(
        archiveFilter(reviews.archivedAt, options),
        options.kind ? eq(reviews.kind, options.kind) : undefined,
      ),
    )
    .orderBy(desc(reviews.period), asc(reviews.kind));
  return rows.map(toReview);
}

export async function get(id: string): Promise<Review | null> {
  const [row] = await db().select().from(reviews).where(eq(reviews.id, id));
  return row ? toReview(row) : null;
}

export async function findByPeriod(
  kind: ReviewKind,
  period: string,
  exec: Executor = db(),
): Promise<Review | null> {
  const [row] = await exec
    .select()
    .from(reviews)
    .where(and(eq(reviews.kind, kind), eq(reviews.period, period)));
  return row ? toReview(row) : null;
}

/** The review of the period right before, if written (for "지난 회고 대비"). */
export async function findPrevious(
  review: Pick<Review, "kind" | "period">,
): Promise<Review | null> {
  return findByPeriod(review.kind, shiftPeriod(review.kind, review.period, -1));
}

/** Non-archived goals a review of this period looks at: its quarter goal(s) and year goals. */
export async function goalsForPeriod(kind: ReviewKind, period: string, exec: Executor = db()) {
  const { quarters, year } = goalPeriodsFor(kind, period);
  return exec
    .select({
      id: goalsTable.id,
      title: goalsTable.title,
      horizon: goalsTable.horizon,
      period: goalsTable.period,
    })
    .from(goalsTable)
    .where(
      and(
        isNull(goalsTable.archivedAt),
        or(
          and(eq(goalsTable.horizon, "quarter"), inArray(goalsTable.period, quarters)),
          and(eq(goalsTable.horizon, "year"), eq(goalsTable.period, year)),
        ),
      ),
    )
    .orderBy(desc(goalsTable.horizon), asc(goalsTable.period), asc(goalsTable.createdAt));
}

async function snapshot(kind: ReviewKind, period: string): Promise<GoalProgressSnapshot> {
  const ids = (await goalsForPeriod(kind, period)).map((g) => g.id);
  return ids.length ? progressFor(ids) : {};
}

/**
 * Opens the review for `kind` + `period`: returns the existing one (one per period) or
 * creates it with the kind's template and a goal progress snapshot.
 */
export async function open(
  kindInput: ReviewKind,
  periodInput: string,
): Promise<{ review: Review; created: boolean }> {
  const kind = requireEnum(REVIEW_KIND, kindInput, "회고 종류");
  const period = requirePeriod(kind, periodInput);
  const existing = await findByPeriod(kind, period);
  if (existing) return { review: existing, created: false };

  // Read outside the write transaction (progressFor uses its own queries).
  const [periodGoals, goalProgress] = await Promise.all([
    goalsForPeriod(kind, period),
    snapshot(kind, period),
  ]);
  const templateGoals = periodGoals.filter((g) =>
    kind === "year" ? g.horizon === "year" : g.horizon === "quarter",
  );

  return withTx(async (tx) => {
    // Another request may have created it meanwhile (unique kind + period).
    const raced = await findByPeriod(kind, period, tx);
    if (raced) return { review: raced, created: false };
    const now = nowIso();
    const row: Row = {
      id: newId(),
      kind,
      period,
      title: reviewTitle(kind, period),
      body: reviewTemplate(kind, templateGoals),
      focus: "[]",
      goalProgress: JSON.stringify(goalProgress),
      completedAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await tx.insert(reviews).values(row);
    return { review: toReview(row), created: true };
  });
}

export type ReviewPatch = {
  body?: string;
  focus?: readonly unknown[];
  /** true: mark written (refreshes the progress snapshot); false: back to draft. */
  completed?: boolean;
};

export async function update(id: string, patch: ReviewPatch): Promise<Review | null> {
  const current = await get(id);
  if (!current) return null;

  const set: Partial<Row> = { updatedAt: nowIso() };
  if (patch.body !== undefined) set.body = patch.body;
  if (patch.focus !== undefined) set.focus = JSON.stringify(normalizeFocus(patch.focus));
  if (patch.completed === true) {
    set.completedAt = current.completedAt ?? nowIso();
    set.goalProgress = JSON.stringify(await snapshot(current.kind, current.period));
  } else if (patch.completed === false) {
    set.completedAt = null;
  }

  const [row] = await withTx((tx) =>
    tx.update(reviews).set(set).where(eq(reviews.id, id)).returning(),
  );
  return row ? toReview(row) : null;
}

/** Deletes the review with its links, tags and saved graph position. */
export async function remove(id: string): Promise<boolean> {
  return withTx(async (tx) => {
    const deleted = await tx
      .delete(reviews)
      .where(eq(reviews.id, id))
      .returning({ id: reviews.id });
    if (!deleted.length) return false;
    await removeLinksFor(tx, ref(id));
    await removeTagsFor(tx, ref(id));
    return true;
  });
}

/** Which of `periods` already have a non-archived-or-archived review of `kind`. */
export async function existingPeriods(
  kind: ReviewKind,
  periods: readonly string[],
): Promise<Set<string>> {
  if (!periods.length) return new Set();
  const rows = await db()
    .select({ period: reviews.period })
    .from(reviews)
    .where(and(eq(reviews.kind, kind), inArray(reviews.period, [...periods])));
  return new Set(rows.map((r) => r.period));
}
