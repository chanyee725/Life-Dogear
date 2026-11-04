// 달력 데이터 계약(docs/PLAN-CALENDAR.md 3절). 서버·클라이언트 공용 — 값만 담는다.

export type CalendarSource =
  | "task"
  | "project"
  | "seminar"
  | "review"
  | "goal"
  | "paper"
  | "google";

export type CalendarItem = {
  /** "<source>:<id>" (google은 "google:<uid>:<start>") */
  id: string;
  source: CalendarSource;
  title: string;
  /** YYYY-MM-DD (종일) 또는 ISO 시각 */
  start: string;
  /** 띠·기간이면 마지막 날(포함) */
  end?: string;
  allDay: boolean;
  /** 앱 화면 또는 Google 링크 */
  href?: string;
  /** 할 일 */
  done?: boolean;
  /** 끌어 놓기용 */
  taskId?: string;
};

export type CalendarRange = { from: string; to: string };

export type CalendarOptions = { papers?: boolean };

export type GoogleStatus = "ok" | "off" | "error";

export type CalendarResult = { items: CalendarItem[]; google: GoogleStatus };

export type GetCalendar = (range: CalendarRange, opts?: CalendarOptions) => Promise<CalendarResult>;
