import "server-only";
/**
 * App dates for the calendar, read-only: one query per source, independent of how many
 * rows match (never one query per item). Archived items are left out. Tasks and project
 * deadlines are not calendar items (they live in the task and project lists), so they are
 * never read here.
 */
import { and, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { goals, papers, reviews, seminars } from "@/db/schema";
import { ITEM_ROUTE } from "@/lib/enums";
import { db } from "@/lib/repo/shared";
import { addDays, dayInZone, overlaps, periodDays, periodsIn } from "./dates";
import type { CalendarItem, CalendarOptions, CalendarRange } from "./types";

export async function collectAppItems(
  range: CalendarRange,
  opts: CalendarOptions = {},
): Promise<CalendarItem[]> {
  const d = db();
  const { from, to } = range;
  const reviewPeriods = [...periodsIn("week", range), ...periodsIn("month", range)];
  const quarterPeriods = periodsIn("quarter", range);

  const [seminarRows, reviewRows, goalRows, paperRows] = await Promise.all([
    d
      .select({ id: seminars.id, title: seminars.title, date: seminars.date })
      .from(seminars)
      .where(and(isNull(seminars.archivedAt), gte(seminars.date, from), lte(seminars.date, to))),
    d
      .select({
        id: reviews.id,
        title: reviews.title,
        kind: reviews.kind,
        period: reviews.period,
      })
      .from(reviews)
      .where(
        and(
          isNull(reviews.archivedAt),
          inArray(reviews.kind, ["week", "month"]),
          inArray(reviews.period, reviewPeriods),
        ),
      ),
    d
      .select({ id: goals.id, title: goals.title, period: goals.period })
      .from(goals)
      .where(
        and(
          isNull(goals.archivedAt),
          sql`${goals.horizon} = 'quarter'`,
          inArray(goals.period, quarterPeriods),
        ),
      ),
    opts.papers
      ? // Timestamps are UTC; widen by a day each side, then keep the zone-local days in range.
        d
          .select({ id: papers.id, title: papers.title, lastReadAt: papers.lastReadAt })
          .from(papers)
          .where(
            and(
              isNull(papers.archivedAt),
              isNotNull(papers.lastReadAt),
              gte(papers.lastReadAt, addDays(from, -1)),
              lte(papers.lastReadAt, `${addDays(to, 1)}T23:59:59.999Z`),
            ),
          )
      : Promise.resolve([]),
  ]);

  const items: CalendarItem[] = [];

  for (const s of seminarRows) {
    items.push({
      id: `seminar:${s.id}`,
      source: "seminar",
      title: s.title,
      start: s.date!,
      allDay: true,
      href: `${ITEM_ROUTE.seminar}/${s.id}`,
    });
  }
  for (const r of reviewRows) {
    const { start, end } = periodDays(r.kind as "week" | "month", r.period);
    if (!overlaps(start, end, range)) continue;
    items.push({
      id: `review:${r.id}`,
      source: "review",
      title: r.title,
      start,
      end,
      allDay: true,
      href: `${ITEM_ROUTE.review}/${r.id}`,
    });
  }
  for (const g of goalRows) {
    const { start, end } = periodDays("quarter", g.period!);
    items.push({
      id: `goal:${g.id}`,
      source: "goal",
      title: g.title,
      start,
      end,
      allDay: true,
      href: `${ITEM_ROUTE.goal}/${g.id}`,
    });
  }
  for (const p of paperRows) {
    const day = dayInZone(p.lastReadAt!);
    if (!day || day < from || day > to) continue;
    items.push({
      id: `paper:${p.id}`,
      source: "paper",
      title: p.title,
      start: day,
      allDay: true,
      href: `${ITEM_ROUTE.paper}/${p.id}`,
    });
  }
  return items;
}
