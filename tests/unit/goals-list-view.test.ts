import { afterEach, describe, expect, it } from "vitest";
import { seoulDate } from "@/components/calendar/model";
import {
  areasWithGoals,
  buildGoalList,
  dueLabel,
  endedCounts,
  filterGroupsByText,
  filterLabels,
  groupStats,
  hasGoalsWithoutArea,
  inPeriod,
  NO_AREA,
  otherYears,
  parsePeriodFilter,
  periodLabel,
  periodEnd,
  periodParam,
  titleMatches,
  type GoalTreeInput,
  type PeriodFilter,
} from "@/app/goals/list-view";
import type { GoalHorizon, GoalStatus } from "@/lib/enums";

// 2026-11-03: this quarter is 2026-Q4.
const NOW = new Date(2026, 10, 3);
const QUARTER: PeriodFilter = { kind: "quarter", period: "2026-Q4" };
const ALL: PeriodFilter = { kind: "all" };

function node(
  id: string,
  horizon: GoalHorizon,
  period: string | null,
  opts: {
    status?: GoalStatus;
    areaId?: string | null;
    progress?: number | null;
    projects?: number;
    children?: GoalTreeInput[];
  } = {},
): GoalTreeInput {
  return {
    goal: {
      id,
      title: id,
      horizon,
      period,
      status: opts.status ?? "active",
      areaId: opts.areaId ?? null,
    },
    progress: opts.progress === undefined ? (horizon === "life" ? null : 0) : opts.progress,
    projects: Array.from({ length: opts.projects ?? 0 }),
    children: opts.children ?? [],
  };
}

const AREAS = [
  { id: "research", title: "연구" },
  { id: "health", title: "건강" },
];

/** Life goal → two year goals (one per area) with quarter goals, plus loose goals. */
function forest(): GoalTreeInput[] {
  return [
    node("방향", "life", null, {
      areaId: "research",
      children: [
        node("논문 2026", "year", "2026", {
          progress: 40,
          children: [
            node("초안 Q4", "quarter", "2026-Q4", { progress: 20, projects: 2 }),
            node("문헌 Q3", "quarter", "2026-Q3", { status: "achieved", progress: 100 }),
            node("운동 Q4", "quarter", "2026-Q4", { areaId: "health", progress: 60 }),
          ],
        }),
      ],
    }),
    node("옛 방향", "life", null, { status: "dropped" }),
    node("체력 2027", "year", "2027", {
      areaId: "health",
      progress: 10,
      children: [node("걷기 2026-Q4", "quarter", "2026-Q4", { progress: 30 })],
    }),
    node("독서 2026", "year", "2026", { status: "achieved", progress: 100, areaId: "nowhere" }),
    node("메모 Q4", "quarter", "2026-Q4", { progress: null }),
    node("블로그 Q4", "quarter", "2026-Q4", { status: "dropped", areaId: "research" }),
  ];
}

const ids = (goals: readonly { id: string }[]) => goals.map((g) => g.id);
const shape = (view: ReturnType<typeof buildGoalList>) =>
  view.groups.map((g) => ({
    area: g.areaId,
    goals: g.goals.map((r) => (r.children.length ? { [r.id]: ids(r.children) } : r.id)),
  }));

describe("period filter param", () => {
  it("defaults to this quarter, reads year/<연도>/all", () => {
    expect(parsePeriodFilter(undefined, NOW)).toEqual(QUARTER);
    expect(parsePeriodFilter("quarter", NOW)).toEqual(QUARTER);
    expect(parsePeriodFilter("bogus", NOW)).toEqual(QUARTER);
    expect(parsePeriodFilter("year", NOW)).toEqual({ kind: "year", year: "2026", current: true });
    expect(parsePeriodFilter("2026", NOW)).toEqual({ kind: "year", year: "2026", current: true });
    expect(parsePeriodFilter("2027", NOW)).toEqual({ kind: "year", year: "2027", current: false });
    expect(parsePeriodFilter("all", NOW)).toEqual(ALL);
  });

  it("round-trips to a param and reads as words", () => {
    for (const p of [undefined, "year", "2027", "all"]) {
      expect(periodParam(parsePeriodFilter(p, NOW))).toBe(p);
    }
    expect(periodLabel(QUARTER)).toBe("이번 분기(2026-Q4)");
    expect(periodLabel(parsePeriodFilter("year", NOW))).toBe("올해(2026)");
    expect(periodLabel(parsePeriodFilter("2027", NOW))).toBe("2027년");
  });

  it("matches the goal's own period", () => {
    expect(inPeriod("2026-Q4", QUARTER)).toBe(true);
    expect(inPeriod("2026", QUARTER)).toBe(true);
    expect(inPeriod("2026-Q3", QUARTER)).toBe(false);
    expect(inPeriod("2027", QUARTER)).toBe(false);
    expect(inPeriod(null, QUARTER)).toBe(false);
    expect(inPeriod("2026-Q1", { kind: "year", year: "2026", current: true })).toBe(true);
    expect(inPeriod(null, ALL)).toBe(true);
  });

  it("lists other years with goals", () => {
    expect(otherYears(forest(), NOW)).toEqual(["2027"]);
  });

  it("keeps the other year being viewed even without goals", () => {
    expect(otherYears(forest(), NOW, "2030")).toEqual(["2027", "2030"]);
    expect(otherYears([], NOW, "2030")).toEqual(["2030"]);
    expect(otherYears([], NOW, "2026")).toEqual([]);
    expect(otherYears([], NOW, null)).toEqual([]);
  });
});

describe("buildGoalList", () => {
  it("this quarter: groups by area in area order, year → quarter, loose goals last", () => {
    const view = buildGoalList(forest(), AREAS, { period: QUARTER });
    expect(ids(view.direction)).toEqual(["방향"]);
    expect(shape(view)).toEqual([
      // The Q3 goal is out of the quarter; the dropped one is in "끝난 목표".
      { area: "research", goals: [{ "논문 2026": ["초안 Q4"] }] },
      // A quarter goal in another area than its year goal stands alone there; the 2027
      // year goal comes in as the parent of a 2026-Q4 goal.
      { area: "health", goals: [{ "체력 2027": ["걷기 2026-Q4"] }, "운동 Q4"] },
      { area: null, goals: ["메모 Q4"] },
    ]);
    // Unknown area → no area; life goals only without a period filter.
    expect(ids(view.ended)).toEqual(["블로그 Q4", "독서 2026"]);
    expect(view.ended.map((g) => g.areaId)).toEqual(["research", null]);
  });

  it("all periods: ended goals newest first, life goals last", () => {
    const view = buildGoalList(forest(), AREAS, { period: ALL });
    expect(shape(view)[0]).toEqual({ area: "research", goals: [{ "논문 2026": ["초안 Q4"] }] });
    expect(ids(view.ended)).toEqual(["블로그 Q4", "문헌 Q3", "독서 2026", "옛 방향"]);
  });

  it("a year: only that year's goals (a parent from another year joins its quarter)", () => {
    const view = buildGoalList(forest(), AREAS, {
      period: parsePeriodFilter("2027", NOW),
    });
    expect(shape(view)).toEqual([{ area: "health", goals: ["체력 2027"] }]);
    expect(view.ended).toEqual([]);
  });

  it("area filter keeps goals by effective area; none keeps goals without one", () => {
    const health = buildGoalList(forest(), AREAS, { period: QUARTER, areaId: "health" });
    expect(shape(health)).toEqual([
      { area: "health", goals: [{ "체력 2027": ["걷기 2026-Q4"] }, "운동 Q4"] },
    ]);
    expect(ids(health.direction)).toEqual(["방향"]);
    const none = buildGoalList(forest(), AREAS, { period: QUARTER, areaId: NO_AREA });
    expect(shape(none)).toEqual([{ area: null, goals: ["메모 Q4"] }]);
    expect(ids(none.ended)).toEqual(["독서 2026"]);
  });

  it("an ended year goal lets its active quarter goals stand on their own", () => {
    const tree = [
      node("Y", "year", "2026", {
        status: "achieved",
        areaId: "research",
        children: [node("Q", "quarter", "2026-Q4")],
      }),
    ];
    const view = buildGoalList(tree, AREAS, { period: QUARTER });
    expect(shape(view)).toEqual([{ area: "research", goals: ["Q"] }]);
    expect(ids(view.ended)).toEqual(["Y"]);
  });

  it("knows which areas have goals", () => {
    const view = buildGoalList(forest(), AREAS, { period: ALL });
    expect(ids(areasWithGoals(view, AREAS))).toEqual(["research", "health"]);
    expect(hasGoalsWithoutArea(view)).toBe(true);
    expect(
      hasGoalsWithoutArea(
        buildGoalList([node("Y", "year", "2026", { areaId: "health" })], AREAS, { period: ALL }),
      ),
    ).toBe(false);
  });
});

describe("group stats and counts", () => {
  it("counts every row and averages the measured ones", () => {
    const view = buildGoalList(forest(), AREAS, { period: QUARTER });
    expect(view.groups.map((g) => groupStats(g.goals))).toEqual([
      { count: 2, average: 30 },
      { count: 3, average: 33 },
      { count: 1, average: null },
    ]);
    const all = buildGoalList(forest(), AREAS, { period: ALL });
    expect(endedCounts(all.ended)).toEqual({ achieved: 2, dropped: 2 });
  });
});

describe("text filter", () => {
  it("matches titles ignoring case and extra spaces", () => {
    expect(titleMatches("Write the Paper", "  the   PAPER ")).toBe(true);
    expect(titleMatches("초안 Q4", "")).toBe(true);
    expect(titleMatches("초안 Q4", "문헌")).toBe(false);
  });

  it("keeps a matching goal whole, else only its matching sub-goals", () => {
    const { groups } = buildGoalList(forest(), AREAS, { period: QUARTER });
    expect(
      filterGroupsByText(groups, "논문").map((g) => g.goals.map((r) => [r.id, ids(r.children)])),
    ).toEqual([[["논문 2026", ["초안 Q4"]]]]);
    expect(
      filterGroupsByText(groups, "걷기").map((g) => g.goals.map((r) => [r.id, ids(r.children)])),
    ).toEqual([[["체력 2027", ["걷기 2026-Q4"]]]]);
    expect(filterGroupsByText(groups, "없는 말")).toEqual([]);
    expect(filterGroupsByText(groups, " ")).toEqual(groups);
  });
});

describe("filterLabels", () => {
  it("names the filters that narrow the list", () => {
    expect(filterLabels({ period: QUARTER, areaTitle: "건강", query: " 논문 " })).toEqual([
      "이번 분기(2026-Q4)",
      "건강 영역",
      "‘논문’ 검색",
    ]);
    expect(filterLabels({ period: ALL, areaTitle: "영역 없음" })).toEqual(["영역 없음"]);
    expect(filterLabels({ period: ALL, query: "" })).toEqual([]);
  });
});

describe("due labels", () => {
  it("ends a period on its last day", () => {
    expect(periodEnd("2026")).toBe("2026-12-31");
    expect(periodEnd("2026-Q1")).toBe("2026-03-31");
    expect(periodEnd("2028-Q1")).toBe("2028-03-31");
    expect(periodEnd("2026-Q2")).toBe("2026-06-30");
    expect(periodEnd(null)).toBeNull();
    expect(periodEnd("x")).toBeNull();
  });

  it("counts days left to the period end", () => {
    const today = "2026-11-03";
    expect(dueLabel("2026-Q4", today)).toBe("D-58");
    expect(dueLabel("2026", "2026-12-31")).toBe("D-day");
    expect(dueLabel("2026-Q3", today)).toBe("끝남");
    expect(dueLabel(null, today)).toBeNull();
  });
});

describe("due labels count from the Seoul date", () => {
  const tz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = tz;
  });

  it("uses the next day in Seoul early morning on a UTC server", () => {
    process.env.TZ = "UTC";
    // 2026-11-05 01:30 in Seoul; still 11-04 on the server clock.
    const at = new Date("2026-11-04T16:30:00Z");
    expect(at.getDate()).toBe(4);
    const today = seoulDate(at);
    expect(today).toBe("2026-11-05");
    expect(dueLabel("2026-Q4", today)).toBe("D-56");
  });
});

describe("this quarter by the Seoul date", () => {
  const tz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = tz;
  });

  it("is already Q2 in Seoul early morning on a UTC server", () => {
    process.env.TZ = "UTC";
    // 2026-04-01 01:30 in Seoul; still 03-31 (Q1) on the server clock.
    const at = new Date("2026-03-31T16:30:00Z");
    expect(at.getMonth()).toBe(2);
    expect(parsePeriodFilter(undefined, at)).toEqual({ kind: "quarter", period: "2026-Q2" });
  });
});
