import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/_actions/tasks", () => ({ createTask: vi.fn(), updateTask: vi.fn() }));
const getCalendar = vi.fn();
vi.mock("@/lib/calendar", () => ({ getCalendar: (...a: unknown[]) => getCalendar(...a) }));
import { CalendarView } from "@/components/calendar/CalendarView";
import { WeekStrip } from "@/components/dashboard/WeekStrip";
import { WeekStripSection } from "@/components/dashboard/WeekStripSection";
import type { CalendarItem } from "@/lib/calendar/types";

const items: CalendarItem[] = [
  {
    id: "task:1",
    source: "task",
    title: "2장 초안",
    start: "2026-11-05",
    allDay: true,
    href: "/tasks",
    taskId: "1",
  },
  {
    id: "task:2",
    source: "task",
    title: "지난 일",
    start: "2026-11-02",
    allDay: true,
    href: "/tasks",
    taskId: "2",
  },
  {
    id: "project:1",
    source: "project",
    title: "투고 마감",
    start: "2026-11-05",
    allDay: true,
    href: "/projects/1",
  },
  {
    id: "goal:1",
    source: "goal",
    title: "논문 2장",
    start: "2026-10-01",
    end: "2026-12-31",
    allDay: true,
    href: "/goals/1",
  },
  {
    id: "review:1",
    source: "review",
    title: "주간 회고",
    start: "2026-11-02",
    end: "2026-11-08",
    allDay: true,
    href: "/reviews/1",
  },
  {
    id: "paper:1",
    source: "paper",
    title: "읽은 논문",
    start: "2026-11-04",
    allDay: true,
    href: "/papers/1",
  },
  {
    id: "google:a:1",
    source: "google",
    title: "연구실 회의",
    start: "2026-11-05T14:00:00+09:00",
    allDay: false,
    href: "https://calendar.google.com/calendar/r/day/2026/11/5",
  },
];

const render = (props: Partial<Parameters<typeof CalendarView>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(CalendarView, {
      range: "month",
      date: "2026-11-04",
      today: "2026-11-04",
      items,
      google: "ok",
      now: "2026-11-04T01:00:00.000Z", // 10:00 in Seoul
      ...props,
    }),
  );

describe("CalendarView (month)", () => {
  it("draws the grid with today marked and one tab stop", () => {
    const html = render();
    expect(html).toContain('role="grid" aria-label="2026년 11월"');
    expect(html).toContain("2026년 11월");
    expect(html.match(/role="gridcell"/g)).toHaveLength(42);
    expect(html).toMatch(
      /data-cal-cell="2026-11-04" tabindex="0" aria-selected="true" aria-current="date"/,
    );
    expect(html.match(/data-cal-cell="[^"]+" tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="오늘, 11월 4일 수요일, 항목 ');
  });

  it("puts the quarter goal on the period line and the weekly review in a bar", () => {
    const html = render();
    expect(html).toMatch(/<ul[^>]*><li[^>]*><svg[^>]*>.*?<\/svg><a[^>]*href="\/goals\/1"/);
    expect(html).toContain(
      'data-cal-on="2026-11-02 2026-11-03 2026-11-04 2026-11-05 2026-11-06 2026-11-07 2026-11-08"',
    );
  });

  it("labels items by source, leaves tasks off, opens Google in a new tab", () => {
    const html = render({ range: "3w" });
    expect(html).toContain('aria-label="프로젝트: 투고 마감, 마감 11월 5일"');
    expect(html).not.toContain("2장 초안");
    expect(html).not.toContain("지난 일");
    expect(html).toContain('aria-label="Google 일정: 14시, 연구실 회의, Google 캘린더에서 열기"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain(">14:00<");
  });

  it("keeps three lines per cell: the review bar + 1 item + '+n'", () => {
    const seminar: CalendarItem = {
      id: "seminar:1",
      source: "seminar",
      title: "랩 세미나",
      start: "2026-11-05",
      allDay: true,
      href: "/seminars/1",
    };
    const html = render({ items: [...items, seminar] });
    expect(html).toContain('aria-label="11월 5일 항목 2개 더 보기"');
    expect(html).toContain('aria-label="프로젝트: 투고 마감, 마감 11월 5일"');
  });

  it("hides papers by default (표시)", () => {
    expect(render()).not.toContain("읽은 논문");
  });

  it("drops Google when it is off and says so in the popover only", () => {
    const html = render({ google: "off", items: items.filter((i) => i.source !== "google") });
    expect(html).not.toContain("연구실 회의");
    expect(html).not.toContain("캘린더를 불러오지 못했습니다");
  });

  it("shows the Google failure and app failure lines", () => {
    expect(render({ google: "error" })).toContain("캘린더를 불러오지 못했습니다.");
    const partial = render({ google: "partial", range: "3w" });
    expect(partial).toContain("캘린더 일정 일부를 불러오지 못했습니다.");
    expect(partial).toContain("연구실 회의"); // what did load still shows
    expect(render({ items: [], failed: true })).toContain("달력을 불러오지 못했습니다.");
  });

  it("shows no empty-period line when nothing is dated", () => {
    expect(render({ items: [] })).not.toContain("표시할 날짜가 없습니다");
    expect(render({ items: [], range: "3w" })).not.toContain("표시할 날짜가 없습니다");
  });
});

describe("CalendarView (3 weeks)", () => {
  it("draws three week rows from Monday with the review as a bar", () => {
    const html = render({ range: "3w" });
    expect(html).toContain('role="grid" aria-label="11월 2일 – 22일"');
    expect(html.match(/role="gridcell"/g)).toHaveLength(21);
    expect(html).toContain('data-cal-on="2026-11-02 2026-11-03');
    expect(html).toContain("lg:h-[7.25rem]");
    expect(html).toContain('aria-label="이전 3주"');
  });

  it("keeps five lines per cell and leaves the time to the panel", () => {
    const many: CalendarItem[] = Array.from({ length: 6 }, (_, i) => ({
      id: `seminar:m${i}`,
      source: "seminar",
      title: `세미나 ${i}`,
      start: "2026-11-10",
      allDay: true,
      href: `/seminars/m${i}`,
    }));
    const html = render({ range: "3w", items: many });
    // 6 items > 5 lines → 4 shown + "+2"
    expect(html).toContain('aria-label="11월 10일 항목 2개 더 보기"');
    const cell = render({ range: "3w", items: items.filter((i) => i.source === "google") });
    const grid = cell.slice(cell.indexOf('role="grid"'), cell.indexOf("aria-labelledby"));
    expect(grid).not.toContain(">14:00<");
  });

  it("marks the selected day and starts on `day` when it is on the grid", () => {
    const html = render({ range: "3w", day: "2026-11-10" });
    expect(html).toMatch(/data-cal-cell="2026-11-10" tabindex="0" aria-selected="true"/);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toContain("11월 10일 화요일");
    expect(html).toContain("오늘로");
    // Off the grid: falls back to today.
    expect(render({ range: "3w", day: "2027-01-01" })).toMatch(
      /data-cal-cell="2026-11-04" tabindex="0" aria-selected="true"/,
    );
  });
});

describe("CalendarView (narrow)", () => {
  it("lists the selected day under the 2-week dot grid", () => {
    const html = render({ range: "3w", day: "2026-11-05", forceNarrow: true });
    const list = html.slice(
      html.indexOf('<section class="mt-4 flex flex-col" aria-label="11월 5일 목요일"'),
    );
    expect(list.length).toBeLessThan(html.length);
    expect(list).toContain('data-cal-item="project:1"');
    expect(list).not.toContain('data-cal-item="task:1"');
    expect(list).toContain('aria-label="11월 5일 마감 할 일 추가"');
  });

  it("drops the day list under the grid with dayList off (home), whatever the panel slot", () => {
    const dayList = '<section class="mt-4 flex flex-col" aria-label="11월 5일 목요일"';
    const base = { range: "3w" as const, day: "2026-11-05", forceNarrow: true };
    expect(render({ ...base, dayList: false })).not.toContain(dayList);
    // A panel slot alone no longer turns it off; the default keeps it.
    expect(render({ ...base, panelSlot: createElement("p", null, "slot") })).toContain(dayList);
  });

  it("puts toolbarEnd (home 빠른 추가) after 표시, before the grid", () => {
    const html = render({
      range: "3w",
      toolbarEnd: createElement("button", { "aria-label": "빠른 추가" }),
    });
    const quick = html.indexOf('aria-label="빠른 추가"');
    expect(quick).toBeGreaterThan(html.indexOf("표시"));
    expect(quick).toBeLessThan(html.indexOf('role="grid"'));
  });
});

describe("TodayPanel (13.3)", () => {
  it("shows today large and what is left, grouped by day", () => {
    const html = render({ range: "3w" });
    expect(html).toMatch(/<h2 id="[^"]+" aria-live="polite"[^>]*>11월 4일 수요일<\/h2>/);
    expect(html).not.toContain("오늘로");
    expect(html).toContain("다음 일정");
    const panel = html.slice(html.indexOf("다음 일정"));
    // 11/5: project, task (no time), Google 14:00 first; papers, goals, reviews never listed.
    expect(panel).toContain(">내일<");
    expect(panel.indexOf("연구실 회의")).toBeLessThan(panel.indexOf("투고 마감"));
    expect(panel).toContain(">14:00<");
    expect(panel).toContain(">마감<");
    expect(panel).not.toContain(">Google<"); // the blue dot already says Google
    expect(panel).not.toContain("주간 회고");
    expect(panel).not.toContain("논문 2장");
    expect(panel).not.toContain("지난 일");
  });

  it("leaves tasks out of 다음 일정 but keeps events", () => {
    const today = [
      { ...items[0], id: "task:9", title: "오늘 마감 일", start: "2026-11-04" },
      { ...items[6], id: "google:a:9", title: "오늘 세미나", start: "2026-11-04T15:00:00+09:00" },
    ];
    const all = [...items, ...today];
    const home = render({ range: "3w", items: all, panelSlot: createElement("p", null, "slot") });
    const panel = home.slice(home.indexOf("다음 일정"));
    expect(panel).not.toContain("오늘 마감 일");
    expect(panel).toContain("오늘 세미나");
    expect(panel).not.toContain("2장 초안"); // tomorrow's task too
    const page = render({ range: "3w", items: all });
    expect(page.slice(page.indexOf("다음 일정"))).not.toContain("오늘 마감 일");
  });

  it("on home drops the 오늘 group when it held only tasks", () => {
    const all = [
      ...items,
      { ...items[0], id: "task:9", title: "오늘 마감 일", start: "2026-11-04" },
    ];
    const home = render({ range: "3w", items: all, panelSlot: createElement("p", null, "slot") });
    const panel = home.slice(home.indexOf("다음 일정"));
    expect(panel).not.toContain('aria-label="11월 4일 수요일"');
    expect(panel).toContain(">내일<");
  });

  it("while loading: grid busy, count shows … (never 0), no empty line; after: no aria-busy", () => {
    const loading = render({
      range: "3w",
      items: [],
      loading: true,
      gridTestId: "home-calendar-grid",
      panelSlot: createElement("p", null, "slot"),
    });
    expect(loading).toMatch(
      /role="grid"[^>]*aria-busy="true"[^>]*data-testid="home-calendar-grid"/,
    );
    expect(loading).toMatch(/data-testid="next-count"[^>]*>…<\/span>/);
    expect(loading).not.toContain(">없음<");
    const done = render({
      range: "3w",
      items: [],
      gridTestId: "home-calendar-grid",
      panelSlot: createElement("p", null, "slot"),
    });
    expect(done).not.toContain("aria-busy");
    expect(done).toMatch(/data-testid="next-count"[^>]*>0<\/span>/);
  });

  it("offers only a quick add when nothing is ahead", () => {
    const html = render({ range: "3w", items: [] });
    expect(html).not.toContain("예정된 일정이 없습니다");
    expect(html).toContain("＋ 할 일 추가");
  });
});

describe("WeekStrip", () => {
  it("links each day to the 2-week view with that day selected and marks today", () => {
    const days = [
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ];
    const html = renderToStaticMarkup(
      createElement(WeekStrip, { days, today: "2026-11-04", items, google: "ok" }),
    );
    expect(html).toContain('<nav aria-label="이번 주">');
    expect(html).toContain('href="/tasks?view=calendar&amp;date=2026-11-05&amp;day=2026-11-05"');
    expect(html).toMatch(/aria-current="date" aria-label="11월 4일 수요일, 항목 없음"/);
    // 11/5: project, google — tasks, the goal and review periods are not counted (9절)
    expect(html).toContain('aria-label="11월 5일 목요일, 항목 2개"');
    expect(html).toContain('aria-label="11월 3일 화요일, 항목 없음"');
    expect(html.match(/<li>/g)).toHaveLength(7);
  });
});

describe("WeekStripSection", () => {
  it("waits behind Suspense with a quiet seven-day placeholder", () => {
    const el = WeekStripSection({ today: "2026-11-04" });
    const fallback = renderToStaticMarkup((el.props as { fallback: React.ReactElement }).fallback);
    expect(fallback).toContain('aria-hidden="true"');
    expect(fallback.match(/<li/g)).toHaveLength(7);
    expect(fallback).not.toContain("href=");
    expect(fallback).toContain("bg-accent-soft");
    expect(getCalendar).not.toHaveBeenCalled();
  });

  it("loads this Seoul week and falls back to an empty strip on failure", async () => {
    getCalendar.mockRejectedValueOnce(new Error("boom"));
    const el = WeekStripSection({ today: "2026-11-04" });
    const child = (el.props as { children: React.ReactElement }).children;
    const Data = child.type as (p: unknown) => Promise<React.ReactElement>;
    const html = renderToStaticMarkup(await Data(child.props));
    expect(getCalendar).toHaveBeenCalledWith(
      { from: "2026-11-02", to: "2026-11-08" },
      { papers: true },
    );
    expect(html).toContain('<nav aria-label="이번 주">');
    expect(html).toContain('aria-label="11월 4일 수요일, 항목 없음"');
  });
});
