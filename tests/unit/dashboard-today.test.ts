import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/_actions/tasks", () => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  moveTask: vi.fn(),
  restoreTask: vi.fn(),
  updateTask: vi.fn(),
}));
import {
  quarterGoal,
  quarterGoalNodes,
  restOfWeek,
  revisitStars,
  seoulToday,
  todayHeading,
} from "@/components/dashboard/today";
import { TodayTasks, WeekTasks } from "@/components/dashboard/TodayTasks";
import { NEGLECTED_MIN_DAYS, NEGLECTED_MIN_SCORE } from "@/lib/cosmos/score";
import type { CosmosNodeInfo } from "@/lib/cosmos/types";
import type { GraphNode, GraphNodeId } from "@/lib/graph/types";
import type { GoalNode } from "@/lib/repo/goals";
import type { Task } from "@/lib/repo/tasks";

const NOW = new Date(2026, 10, 3, 12); // Tue 2026-11-03
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

describe("today helpers", () => {
  it("covers tomorrow through Sunday, nothing on Sunday", () => {
    expect(restOfWeek("2026-11-03")).toEqual({ from: "2026-11-04", to: "2026-11-08" });
    expect(restOfWeek("2026-11-02")).toEqual({ from: "2026-11-03", to: "2026-11-08" });
    expect(restOfWeek("2026-11-07")).toEqual({ from: "2026-11-08", to: "2026-11-08" });
    expect(restOfWeek("2026-11-08")).toBeNull();
    expect(restOfWeek("2026-12-29")).toEqual({ from: "2026-12-30", to: "2027-01-03" });
  });

  it("writes the date line", () => {
    expect(todayHeading("2026-11-03")).toBe("11월 3일 화요일");
  });

  it("takes today in Seoul, not the server zone", () => {
    // 2026-11-03 16:30 UTC = 11-04 01:30 KST: a UTC server would still say the 3rd.
    const { today, day } = seoulToday(new Date("2026-11-03T16:30:00Z"));
    expect(today).toBe("2026-11-04");
    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([2026, 10, 4]);
    expect(seoulToday(new Date("2026-11-04T14:59:00Z")).today).toBe("2026-11-04");
    expect(seoulToday(new Date("2026-11-04T15:00:00Z")).today).toBe("2026-11-05");
  });

  const node = (
    id: string,
    goal: Partial<GoalNode["goal"]>,
    extra: Partial<GoalNode> = {},
  ): GoalNode =>
    ({
      goal: {
        id,
        title: id,
        horizon: "quarter",
        period: "2026-Q4",
        status: "active",
        archivedAt: null,
        progressMode: "auto",
        ...goal,
      },
      progress: 50,
      children: [],
      projects: [],
      ...extra,
    }) as GoalNode;

  it("picks this quarter's active goals and names the progress basis", () => {
    const q4 = node("q4", {}, { projects: [{ done: true }, { done: false }] as never });
    const tree = [
      node(
        "y",
        { horizon: "year", period: "2026" },
        {
          children: [
            q4,
            node("q3", { period: "2026-Q3" }),
            node("done", { status: "achieved" }),
            node("tasks", {}),
            node("manual", { progressMode: "manual" }),
          ],
        },
      ),
    ];
    const picked = quarterGoalNodes(tree, "2026-Q4");
    expect(picked.map((n) => n.goal.id)).toEqual(["q4", "tasks", "manual"]);
    expect(quarterGoal(q4, undefined).basis).toBe("프로젝트 1/2");
    expect(quarterGoal(picked[1]!, { done: 2, total: 5 }).basis).toBe("할 일 2/5");
    expect(quarterGoal(picked[1]!, { done: 0, total: 0 }).basis).toBeNull();
    expect(quarterGoal(picked[2]!, { done: 2, total: 5 }).basis).toBeNull();
  });

  it("revisits the cosmos panel's neglected stars, highest score first, at most 3", () => {
    const nodes: GraphNode[] = [];
    const cosmos: Record<GraphNodeId, CosmosNodeInfo> = {};
    const add = (id: GraphNodeId, score: number, days: number) => {
      nodes.push({ id, type: id.split(":")[0] as never, title: id, size: 1, archived: false });
      cosmos[id] = {
        score,
        direct: 0,
        centrality: 0,
        recency: 0,
        starred: false,
        sun: false,
        galaxy: null,
        lastActiveAt: ago(days),
      };
    };
    const old = NEGLECTED_MIN_DAYS + 5;
    add("paper:a", 0.6, old + 30);
    add("paper:b", 0.9, old);
    add("thought:c", 0.7, old + 10);
    add("project:d", 0.8, old + 1);
    add("paper:low", NEGLECTED_MIN_SCORE - 0.01, old);
    add("paper:fresh", 0.95, NEGLECTED_MIN_DAYS - 1);
    add("goal:g", 0.99, old);
    const stars = revisitStars({ nodes, cosmos }, NOW);
    expect(stars.map((s) => s.id)).toEqual(["b", "d", "c"]);
    expect(stars[0]).toMatchObject({ type: "paper", href: "/papers/b", title: "paper:b" });
  });
});

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: `할 일 ${id}`,
  doneAt: null,
  dueDate: "2026-11-03",
  parentType: null,
  parentId: null,
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
  ...extra,
});

describe("today task sections", () => {
  it("shows overdue first with its date, counts and the empty line", () => {
    const html = renderToStaticMarkup(
      createElement(TodayTasks, {
        overdue: [
          task("o", {
            dueDate: "2026-11-01",
            parentType: "project",
            parentId: "p",
            parentTitle: "논문 A",
          }),
        ],
        dueToday: [task("t")],
        today: "2026-11-03",
      }),
    );
    expect(html.indexOf("할 일 o")).toBeLessThan(html.indexOf("할 일 t"));
    expect(html).toContain("지남 · 2026.11.01");
    expect(html).toContain('href="/projects/p"');
    expect(html).toContain("text-tone-red-fg");
    expect(html).not.toContain(">오늘</span>"); // today's rows hide the due text
    const empty = renderToStaticMarkup(
      createElement(TodayTasks, { overdue: [], dueToday: [], today: "2026-11-03" }),
    );
    expect(empty).not.toContain("할 일이 없습니다");
    expect(empty).toContain("＋ 할 일 추가");
  });

  it("hides this week when empty and caps it at 5", () => {
    expect(renderToStaticMarkup(createElement(WeekTasks, { tasks: [], today: "2026-11-03" }))).toBe(
      "",
    );
    const many = Array.from({ length: 7 }, (_, i) => task(`w${i}`, { dueDate: "2026-11-04" }));
    const html = renderToStaticMarkup(
      createElement(WeekTasks, { tasks: many, today: "2026-11-03" }),
    );
    expect(html).toContain("내일");
    expect(html).toContain("+ 2개 더");
    expect(html).not.toContain("할 일 w5");
  });
});
