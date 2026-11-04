import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarView } from "@/components/calendar/CalendarView";
import { fetchRange, parseCalendarQuery, seoulDate } from "@/components/calendar/model";
import { SegmentedLinks } from "@/components/calendar/Segmented";
import { LinkTabs } from "@/components/list/Tabs";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { dayLabel, isoWeekRange } from "@/components/tasks/dates";
import { parentHref } from "@/components/tasks/format";
import { TaskList } from "@/components/tasks/TaskList";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCalendar, type CalendarResult } from "@/lib/calendar";
import { areas, goals, projects, tasks } from "@/lib/repo";
import { describeError } from "@/lib/storage/describe-error";
import type { Task, TaskParentType } from "@/lib/repo/tasks";

export const metadata: Metadata = { title: "할 일" };
export const dynamic = "force-dynamic";

const TABS = [
  { value: "today", label: "오늘" },
  { value: "week", label: "이번 주" },
  { value: "overdue", label: "마감 지남" },
  { value: "by-parent", label: "소속별" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const isTab = (v: unknown): v is Tab => TABS.some((t) => t.value === v);

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const byDue = (a: Task, b: Task) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "");

/** Date heading + task list (today/week tabs). */
function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <h2 className="flex h-8 items-baseline gap-2">
        <span className="text-[13px] font-semibold text-muted">{title}</span>
        <span className="text-xs text-muted tabular-nums">{count}</span>
      </h2>
      {children}
    </section>
  );
}

/** `[목록 | 달력]` in the header (calendar.md 1절). */
function ViewSwitch({ view }: { view: "list" | "calendar" }) {
  return (
    <SegmentedLinks
      ariaLabel="보기"
      active={view}
      options={[
        { value: "list", label: "목록", href: "/tasks" },
        { value: "calendar", label: "달력", href: "/tasks?view=calendar" },
      ]}
    />
  );
}

/**
 * Calendar view: one `getCalendar` call from the grid's first day up to the 93-day limit, so the
 * today panel's "다음 일정" can look past the grid (papers always fetched; "표시" filters).
 */
async function CalendarPage({ params }: { params: Record<string, string | string[] | undefined> }) {
  const today = seoulDate();
  const q = parseCalendarQuery(params, today);
  let data: CalendarResult = { items: [], google: "off" };
  let failed = false;
  try {
    data = await getCalendar(fetchRange(q.range, q.date), { papers: true });
  } catch (error) {
    console.error("calendar: app data failed", describeError(error));
    failed = true;
  }
  return (
    <Page className="max-w-[1600px]">
      <PageHeader title="할 일" className="mb-0" actions={<ViewSwitch view="calendar" />} />
      <CalendarView
        range={q.range}
        date={q.date}
        today={today}
        items={data.items}
        google={data.google}
        failed={failed}
        day={q.day}
        now={new Date().toISOString()}
      />
    </Page>
  );
}

export default async function TasksPage({ searchParams }: Props) {
  const params = await searchParams;
  if (parseCalendarQuery(params, "").view === "calendar") return <CalendarPage params={params} />;
  const raw = params.tab;
  const tab: Tab = isTab(raw) ? raw : "today";
  // Seoul day, as in the calendar and home (servers may run in UTC).
  const today = seoulDate();
  const week = isoWeekRange(today);

  // Every open task in one query; the tabs are slices of it.
  const open = await tasks.list({ done: false });
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).sort(byDue);
  const dueToday = open.filter((t) => t.dueDate === today);
  const thisWeek = open
    .filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= week.to)
    .sort(byDue);

  const counts: Record<Tab, number> = {
    today: overdue.length + dueToday.length,
    week: thisWeek.length,
    overdue: overdue.length,
    "by-parent": open.length,
  };

  return (
    <Page>
      <PageHeader title="할 일" actions={<ViewSwitch view="list" />} />
      <LinkTabs
        ariaLabel="할 일 보기"
        active={tab}
        tabs={TABS.map((t) => ({
          value: t.value,
          label: t.label,
          href: t.value === "today" ? "/tasks" : `/tasks?tab=${t.value}`,
          count: counts[t.value],
          // Design: the overdue count (only the number) turns red once anything is late.
          countClassName:
            t.value === "overdue" && counts.overdue > 0 ? "text-tone-red-fg" : undefined,
        }))}
      />
      <div className="mt-6 flex flex-col gap-6">
        {tab === "today" ? (
          <>
            {overdue.length ? (
              <Group title="마감 지남" count={overdue.length}>
                <TaskList tasks={overdue} today={today} showParent showCompleted={false} />
              </Group>
            ) : null}
            {dueToday.length || !overdue.length ? (
              <Group title="오늘" count={dueToday.length}>
                {dueToday.length ? null : (
                  <EmptyState title="오늘 할 일이 없습니다" />
                )}
                <TaskList
                  tasks={dueToday}
                  today={today}
                  showParent
                  dueMode="overdue"
                  showCompleted={false}
                  addTo={{ parent: null, dueDate: today }}
                />
              </Group>
            ) : (
              <TaskList
                tasks={[]}
                today={today}
                showCompleted={false}
                addTo={{ parent: null, dueDate: today }}
              />
            )}
          </>
        ) : null}

        {tab === "week" ? (
          thisWeek.length ? (
            groupByDay(thisWeek).map(([day, list]) => (
              <Group key={day} title={dayLabel(day, today)} count={list.length}>
                <TaskList
                  tasks={list}
                  today={today}
                  showParent
                  dueMode="overdue"
                  showCompleted={false}
                />
              </Group>
            ))
          ) : (
            <EmptyState title="이번 주 마감이 없습니다" />
          )
        ) : null}

        {tab === "overdue" ? (
          overdue.length ? (
            <TaskList tasks={overdue} today={today} showParent showCompleted={false} />
          ) : (
            <EmptyState title="밀린 할 일이 없습니다" />
          )
        ) : null}

        {tab === "by-parent" ? <ByParent open={open} today={today} /> : null}
      </div>
    </Page>
  );
}

function groupByDay(list: Task[]): [string, Task[]][] {
  const out = new Map<string, Task[]>();
  for (const t of list) out.set(t.dueDate!, [...(out.get(t.dueDate!) ?? []), t]);
  return [...out];
}

const KIND_TITLE: Record<TaskParentType, string> = {
  project: "프로젝트",
  goal: "목표",
  area: "영역",
};

async function ByParent({ open, today }: { open: Task[]; today: string }) {
  const [projectList, goalList, areaList] = await Promise.all([
    projects.list(),
    goals.list(),
    areas.list(),
  ]);
  const order: Record<TaskParentType, string[]> = {
    project: [...projectList]
      .sort(
        (a, b) =>
          (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
          a.title.localeCompare(b.title, "ko"),
      )
      .map((p) => p.id),
    goal: goalList.map((g) => g.id),
    area: areaList.map((a) => a.id),
  };
  const byParent = new Map<string, Task[]>();
  for (const t of open) {
    const key = t.parentType ? `${t.parentType}:${t.parentId}` : "inbox";
    byParent.set(key, [...(byParent.get(key) ?? []), t]);
  }
  const counts = await tasks.countFor(
    (["project", "goal", "area"] as const).flatMap((type) =>
      order[type].filter((id) => byParent.has(`${type}:${id}`)).map((id) => ({ type, id })),
    ),
  );
  const inbox = byParent.get("inbox") ?? [];

  return (
    <div className="flex flex-col gap-8">
      {open.length === 0 ? (
        <EmptyState title="아직 할 일이 없습니다" />
      ) : null}
      {(["project", "goal", "area"] as const).map((type) => {
        const ids = order[type].filter((id) => byParent.has(`${type}:${id}`));
        if (!ids.length) return null;
        return (
          <section key={type} className="flex flex-col gap-4">
            <h2 className="text-[13px] font-semibold text-muted">{KIND_TITLE[type]}</h2>
            {ids.map((id) => {
              const list = byParent.get(`${type}:${id}`)!;
              const count = counts[`${type}:${id}`];
              const href = parentHref(list[0]!)!;
              return (
                <div key={id} className="flex flex-col">
                  <div className="flex h-9 items-center gap-2">
                    <Link
                      href={href}
                      className="min-w-0 truncate text-sm font-medium text-fg hover:underline"
                    >
                      {list[0]!.parentTitle}
                    </Link>
                    {count ? (
                      <span className="text-xs text-muted tabular-nums">
                        {count.done}/{count.total}
                      </span>
                    ) : null}
                    <Link href={href} className="ml-auto text-muted hover:text-fg">
                      <span aria-hidden>→</span>
                      <span className="sr-only">열기</span>
                    </Link>
                  </div>
                  <TaskList
                    tasks={list}
                    today={today}
                    reorderable
                    showCompleted={false}
                    addTo={{ parent: { type, id } }}
                  />
                </div>
              );
            })}
          </section>
        );
      })}
      <section className="flex flex-col gap-1">
        <h2 className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-muted">소속 없음</span>
          <span className="text-xs text-muted tabular-nums">{inbox.length}</span>
        </h2>
        <TaskList
          tasks={inbox}
          today={today}
          reorderable
          showCompleted={false}
          addTo={{ parent: null }}
        />
      </section>
    </div>
  );
}
