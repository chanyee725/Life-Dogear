/**
 * Enum values stored in the database, with Korean labels and badge tones.
 * Badge tones are semantic tokens; the design system maps them to colors.
 */

export type BadgeTone = "gray" | "blue" | "green" | "amber" | "red" | "violet" | "teal" | "rose";

export type EnumOption<V extends string> = {
  readonly value: V;
  readonly label: string;
  readonly tone: BadgeTone;
};

function defineEnum<const V extends string>(options: readonly EnumOption<V>[]) {
  const values = options.map((o) => o.value) as unknown as readonly [V, ...V[]];
  const byValue = new Map<string, EnumOption<V>>(options.map((o) => [o.value, o]));
  return {
    options,
    values,
    is: (value: unknown): value is V => typeof value === "string" && byValue.has(value),
    label: (value: V): string => byValue.get(value)?.label ?? value,
    tone: (value: V): BadgeTone => byValue.get(value)?.tone ?? "gray",
  };
}

export const ITEM_TYPE = defineEnum([
  { value: "project", label: "프로젝트", tone: "violet" },
  { value: "paper", label: "논문", tone: "blue" },
  { value: "seminar", label: "세미나", tone: "teal" },
  { value: "thought", label: "생각", tone: "amber" },
  { value: "area", label: "영역", tone: "rose" },
  { value: "goal", label: "목표", tone: "red" },
  { value: "review", label: "회고", tone: "gray" },
] as const);
export type ItemType = (typeof ITEM_TYPE.values)[number];

/** URL segment for each item type, e.g. `/papers/<id>`. */
export const ITEM_ROUTE: Record<ItemType, string> = {
  project: "/projects",
  area: "/areas",
  paper: "/papers",
  seminar: "/seminars",
  thought: "/thoughts",
  goal: "/goals",
  review: "/reviews",
};

/** Goal horizon: life goals have no period, year `2027`, quarter `2027-Q1`. */
export const GOAL_HORIZON = defineEnum([
  { value: "life", label: "인생", tone: "red" },
  { value: "year", label: "연", tone: "violet" },
  { value: "quarter", label: "분기", tone: "blue" },
] as const);
export type GoalHorizon = (typeof GOAL_HORIZON.values)[number];

export const GOAL_STATUS = defineEnum([
  { value: "active", label: "진행 중", tone: "blue" },
  { value: "achieved", label: "달성", tone: "green" },
  { value: "dropped", label: "내려놓음", tone: "gray" },
] as const);
export type GoalStatus = (typeof GOAL_STATUS.values)[number];

/** Auto: computed from projects (quarter) or child goals (year). Manual: `manual_progress`. */
export const GOAL_PROGRESS_MODE = defineEnum([
  { value: "auto", label: "자동", tone: "gray" },
  { value: "manual", label: "직접 입력", tone: "gray" },
] as const);
export type GoalProgressMode = (typeof GOAL_PROGRESS_MODE.values)[number];

/** Review kind; period values: week `2026-W45`, month `2026-11`, quarter `2026-Q4`, year `2026`. */
export const REVIEW_KIND = defineEnum([
  { value: "week", label: "주간", tone: "gray" },
  { value: "month", label: "월간", tone: "blue" },
  { value: "quarter", label: "분기", tone: "violet" },
  { value: "year", label: "연간", tone: "red" },
] as const);
export type ReviewKind = (typeof REVIEW_KIND.values)[number];

/**
 * Where a link came from. `manual`: made with the link button (or a highlight).
 * `body`: synced from a `[[title]]` in the source body. One link per pair; manual wins.
 */
export const LINK_VIA = defineEnum([
  { value: "manual", label: "직접 연결", tone: "gray" },
  { value: "body", label: "본문 링크", tone: "gray" },
] as const);
export type LinkVia = (typeof LINK_VIA.values)[number];

/** Project kind: research projects use the 8 stages, general ones only a status. */
export const PROJECT_KIND = defineEnum([
  { value: "research", label: "연구", tone: "violet" },
  { value: "general", label: "일반", tone: "gray" },
] as const);
export type ProjectKind = (typeof PROJECT_KIND.values)[number];

export const PROJECT_STATUS = defineEnum([
  { value: "active", label: "진행 중", tone: "blue" },
  { value: "on_hold", label: "보류", tone: "amber" },
  { value: "done", label: "완료", tone: "green" },
] as const);
export type ProjectStatus = (typeof PROJECT_STATUS.values)[number];

export const PROJECT_STAGE = defineEnum([
  { value: "exploring", label: "주제 탐색", tone: "gray" },
  { value: "topic_set", label: "주제 확정", tone: "blue" },
  { value: "proposal", label: "제안서 작성", tone: "violet" },
  { value: "lit_review", label: "문헌 검토", tone: "teal" },
  { value: "data_collection", label: "데이터 수집", tone: "amber" },
  { value: "drafting", label: "초안 작성", tone: "blue" },
  { value: "revising", label: "수정·교정", tone: "red" },
  { value: "submitted", label: "제출 완료", tone: "green" },
] as const);
export type ProjectStage = (typeof PROJECT_STAGE.values)[number];

export const READ_STATUS = defineEnum([
  { value: "to_read", label: "읽을 예정", tone: "gray" },
  { value: "reading", label: "읽는 중", tone: "blue" },
  { value: "done", label: "다 읽음", tone: "green" },
] as const);
export type ReadStatus = (typeof READ_STATUS.values)[number];

export const IMPORTANCE = defineEnum([
  { value: "core", label: "핵심", tone: "red" },
  { value: "reference", label: "참고", tone: "blue" },
  { value: "light", label: "가볍게", tone: "gray" },
] as const);
export type Importance = (typeof IMPORTANCE.values)[number];

/** 세미나 = one you attended (talks, lectures, webinars); 발표 = one you gave. Migration 0006. */
export const SEMINAR_KIND = defineEnum([
  { value: "seminar", label: "세미나", tone: "teal" },
  { value: "talk", label: "발표", tone: "violet" },
] as const);
export type SeminarKind = (typeof SEMINAR_KIND.values)[number];

export const THOUGHT_KIND = defineEnum([
  { value: "idea", label: "아이디어", tone: "amber" },
  { value: "question", label: "질문", tone: "blue" },
  { value: "critique", label: "비판·반론", tone: "red" },
  { value: "connection", label: "연결 발견", tone: "violet" },
  { value: "memo", label: "메모", tone: "gray" },
] as const);
export type ThoughtKind = (typeof THOUGHT_KIND.values)[number];

export const THOUGHT_MATURITY = defineEnum([
  { value: "seed", label: "씨앗", tone: "gray" },
  { value: "growing", label: "자라는 중", tone: "teal" },
  { value: "refined", label: "정리됨", tone: "green" },
] as const);
export type ThoughtMaturity = (typeof THOUGHT_MATURITY.values)[number];

/** Areas offered when the user has none yet (created only when chosen). */
export const RECOMMENDED_AREAS = [
  { title: "연구 분야", standard: "관심 분야의 새 논문·세미나를 꾸준히 따라간다." },
  { title: "학위", standard: "학기별 요건과 마감을 놓치지 않는다." },
  { title: "건강", standard: "잠·운동·식사를 무너지지 않게 유지한다." },
  { title: "커리어", standard: "이력과 다음 진로 선택지를 분기마다 정리한다." },
] as const;
