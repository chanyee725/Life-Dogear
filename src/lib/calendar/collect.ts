import "server-only";
/**
 * App dates for the calendar, read-only: one query per source, independent of how many
 * rows match (never one query per item). Archived items, and tasks of archived parents,
 * are left out.
 */
import { and, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { areas, goals, papers, projects, reviews, seminars, tasks } from "@/db/schema";
import { ITEM_ROUTE } from "@/lib/enums";
import { db } from "@/lib/repo/shared";
import { addDays, dayInZone, overlaps, periodDays, periodsIn } from "./dates";
import type { CalendarItem, CalendarOptions, CalendarRange } from "./types";

const TASKS_ROUTE = "/tasks";

export async function collectAppItems(
  range: CalendarRange,
  opts: CalendarOptions = {},
): Promise<CalendarItem[]> {
  const d = db();
  const { from, to } = range;
  const reviewPeriods = [...periodsIn("week", range), ...periodsIn("month", range)];
  const quarterPeriods = periodsIn("quarter", range);

  const [taskRows, projectRows, seminarRows, reviewRows, goalRows, paperRows] = await Promise.all([
    // Tasks of an archived parent are hidden, as in the task lists.
    d
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        doneAt: tasks.doneAt,
        parentType: tasks.parentType,
        parentId: tasks.parentId,
        parentTitle: sql<
          string | null
        >`coalesce(${projects.title}, ${goals.title}, ${areas.title})`,
      })
      .from(tasks)
      .leftJoin(
        projects,
        sql`${tasks.parentType} = 'project' and ${tasks.parentId} = ${projects.id}`,
      )
      .leftJoin(goals, sql`${tasks.parentType} = 'goal' and ${tasks.parentId} = ${goals.id}`)
      .leftJoin(areas, sql`${tasks.parentType} = 'area' and ${tasks.parentId} = ${areas.id}`)
      .where(
        and(
          isNull(tasks.archivedAt),
          gte(tasks.dueDate, from),
          lte(tasks.dueDate, to),
          sql`coalesce(${projects.archivedAt}, ${goals.archivedAt}, ${areas.archivedAt}) is null`,
        ),
      ),
    d
      .select({ id: projects.id, title: projects.title, dueDate: projects.dueDate })
      .from(projects)
      .where(
        and(isNull(projects.archivedAt), gte(projects.dueDate, from), lte(projects.dueDate, to)),
      ),
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

  for (const t of taskRows) {
    items.push({
      id: `task:${t.id}`,
      source: "task",
      title: t.title,
      start: t.dueDate!,
      allDay: true,
      href: t.parentType && t.parentId ? `${ITEM_ROUTE[t.parentType]}/${t.parentId}` : TASKS_ROUTE,
      done: t.doneAt !== null,
      taskId: t.id,
      ...(t.parentTitle ? { parent: t.parentTitle } : {}),
    });
  }
  for (const p of projectRows) {
    items.push({
      id: `project:${p.id}`,
      source: "project",
      title: p.title,
      start: p.dueDate!,
      allDay: true,
      href: `${ITEM_ROUTE.project}/${p.id}`,
    });
  }
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
