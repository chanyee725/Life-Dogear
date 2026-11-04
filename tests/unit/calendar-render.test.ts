import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/_actions/tasks", () => ({ createTask: vi.fn(), updateTask: vi.fn() }));
import { CalendarView } from "@/components/calendar/CalendarView";
import { WeekStrip } from "@/components/dashboard/WeekStrip";
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
      ...props,
    }),
  );

describe("CalendarView (month)", () => {
  it("draws the grid with today marked and one tab stop", () => {
    const html = render();
    expect(html).toContain('role="grid" aria-label="2026년 11월"');
    expect(html).toContain("2026년 11월");
    expect(html.match(/role="gridcell"/g)).toHaveLength(42);
    expect(html).toMatch(/data-cal-cell="2026-11-04" tabindex="0" aria-current="date"/);
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

  it("labels items by source, marks overdue tasks, opens Google in a new tab", () => {
    const html = render({ range: "week" });
    expect(html).toContain('aria-label="할 일: 2장 초안, 마감 11월 5일"');
    expect(html).toContain('aria-label="할 일: 지난 일, 마감 11월 2일, 마감 지남"');
    expect(html).toContain("text-tone-red-fg");
    expect(html).toContain('aria-label="Google 일정: 14시, 연구실 회의, Google 캘린더에서 열기"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain(">14:00<");
  });

  it("keeps three lines per cell: the review bar + 1 item + '+n'", () => {
    const html = render();
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
    const partial = render({ google: "partial", range: "week" });
    expect(partial).toContain("캘린더 일정 일부를 불러오지 못했습니다.");
    expect(partial).toContain("연구실 회의"); // what did load still shows
    expect(render({ items: [], failed: true })).toContain("달력을 불러오지 못했습니다.");
  });

  it("shows the empty line when nothing is dated", () => {
    expect(render({ items: [] })).toContain("이번 달에 표시할 날짜가 없습니다.");
    expect(render({ items: [], range: "week" })).toContain("이번 주에 표시할 날짜가 없습니다.");
  });
});

describe("CalendarView (week)", () => {
  it("shows a week title and the review on the period line", () => {
    const html = render({ range: "week" });
    expect(html).toContain("11월 2일 – 8일");
    expect(html).toContain('href="/reviews/1"');
    expect(html).not.toContain("data-cal-on=");
    expect(html.match(/role="gridcell"/g)).toHaveLength(7);
  });
});

describe("WeekStrip", () => {
  it("links each day to the week view and marks today", () => {
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
    expect(html).toContain('href="/tasks?view=calendar&amp;range=week&amp;date=2026-11-05"');
    expect(html).toMatch(/aria-current="date" aria-label="11월 4일 수요일, 항목 \d+개"/);
    // 11/5: task, project, google + goal + review (papers off)
    expect(html).toContain('aria-label="11월 5일 목요일, 항목 5개"');
    expect(html.match(/<li>/g)).toHaveLength(7);
  });
});
