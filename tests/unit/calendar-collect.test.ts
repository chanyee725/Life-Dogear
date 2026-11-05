import type { Client } from "@libsql/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { areas, goals, papers, projects, reviews, seminars, tasks } from "@/db/schema";
import { getCalendar } from "@/lib/calendar";
import { periodsIn } from "@/lib/calendar/dates";
import { useFreshDb } from "./repo-helpers";

vi.mock("@/lib/calendar/ics", () => ({
  loadGoogleItems: vi.fn(async () => ({ items: [], status: "off" })),
}));

const T = "2026-11-01T00:00:00.000Z";
const ts = { createdAt: T, updatedAt: T };
const tts = { ...ts, sortOrder: 0 };
const NOV = { from: "2026-11-01", to: "2026-11-30" };

let db: Awaited<ReturnType<typeof useFreshDb>>;
beforeEach(async () => {
  db = await useFreshDb();
});

async function seed() {
  await db.insert(areas).values([
    { id: "a1", title: "영역", ...ts },
    { id: "a2", title: "보관 영역", archivedAt: T, ...ts },
  ]);
  await db.insert(goals).values([
    { id: "y", title: "연 목표", horizon: "year", period: "2026", ...ts },
    { id: "q4", title: "Q4 목표", horizon: "quarter", period: "2026-Q4", parentId: "y", ...ts },
    { id: "q1", title: "다음 해", horizon: "quarter", period: "2027-Q1", parentId: "y", ...ts },
    { id: "qa", title: "보관 목표", horizon: "quarter", period: "2026-Q4", archivedAt: T, ...ts },
  ]);
  await db.insert(projects).values([
    { id: "p1", title: "프로젝트", dueDate: "2026-11-20", ...ts },
    { id: "p2", title: "보관 프로젝트", dueDate: "2026-11-21", archivedAt: T, ...ts },
    { id: "p3", title: "범위 밖", dueDate: "2026-12-01", ...ts },
  ]);
  await db.insert(tasks).values([
    { id: "t1", title: "받은 할 일", dueDate: "2026-11-05", ...tts },
    {
      id: "t2",
      title: "끝낸 할 일",
      dueDate: "2026-11-06",
      doneAt: T,
      parentType: "project" as const,
      parentId: "p1",
      ...tts,
    },
    {
      id: "t3",
      title: "보관 부모",
      dueDate: "2026-11-07",
      parentType: "area" as const,
      parentId: "a2",
      ...tts,
    },
    { id: "t4", title: "마감 없음", ...tts },
    {
      id: "t5",
      title: "영역 할 일",
      dueDate: "2026-11-30",
      parentType: "area" as const,
      parentId: "a1",
      ...tts,
    },
  ]);
  await db.insert(seminars).values([
    { id: "s1", title: "세미나", date: "2026-11-12", ...ts },
    { id: "s2", title: "보관 세미나", date: "2026-11-13", archivedAt: T, ...ts },
  ]);
  await db.insert(reviews).values([
    { id: "rw", kind: "week", period: "2026-W45", title: "2026-W45 주간 회고", ...ts },
    { id: "rw0", kind: "week", period: "2026-W44", title: "2026-W44 주간 회고", ...ts },
    { id: "rm", kind: "month", period: "2026-11", title: "2026-11 월간 회고", ...ts },
    { id: "rq", kind: "quarter", period: "2026-Q4", title: "분기 회고", ...ts },
    { id: "rx", kind: "week", period: "2026-W46", title: "보관 회고", archivedAt: T, ...ts },
  ]);
  await db.insert(papers).values([
    // 2026-11-09 23:30 UTC is 2026-11-10 in Seoul.
    { id: "pp", title: "읽은 논문", lastReadAt: "2026-11-09T23:30:00.000Z", ...ts },
    { id: "pq", title: "범위 밖 논문", lastReadAt: "2026-10-31T14:59:00.000Z", ...ts },
  ]);
}

describe("getCalendar (app dates)", () => {
  it("collects each source with routes, leaving archived items, tasks and projects out", async () => {
    await seed();
    const { items, google } = await getCalendar(NOV);
    expect(google).toBe("off");
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(Object.keys(byId).sort()).toEqual(
      [
        "goal:q4",
        "review:rm",
        "review:rw",
        "review:rw0", // W44 runs 10-26..11-01 and touches the range
        "seminar:s1",
      ].sort(),
    );
    expect(byId["seminar:s1"]).toMatchObject({ start: "2026-11-12", href: "/seminars/s1" });
    expect(byId["review:rw"]).toMatchObject({
      start: "2026-11-02",
      end: "2026-11-08",
      href: "/reviews/rw",
    });
    expect(byId["review:rm"]).toMatchObject({ start: "2026-11-01", end: "2026-11-30" });
    expect(byId["goal:q4"]).toMatchObject({
      start: "2026-10-01",
      end: "2026-12-31",
      href: "/goals/q4",
    });
    // Sorted by day.
    const days = items.map((i) => i.start.slice(0, 10));
    expect(days).toEqual([...days].sort());
  });

  it("adds read papers only when asked, on the Seoul day", async () => {
    await seed();
    const { items } = await getCalendar(NOV, { papers: true });
    const read = items.filter((i) => i.source === "paper");
    expect(read).toEqual([
      {
        id: "paper:pp",
        source: "paper",
        title: "읽은 논문",
        start: "2026-11-10",
        allDay: true,
        href: "/papers/pp",
      },
    ]);
  });

  it("rejects bad or too long ranges", async () => {
    await expect(getCalendar({ from: "2026-11-31", to: "2026-12-01" })).rejects.toThrow();
    await expect(getCalendar({ from: "2026-11-02", to: "2026-11-01" })).rejects.toThrow();
    await expect(getCalendar({ from: "2026-01-01", to: "2026-12-31" })).rejects.toThrow();
  });

  it("uses a fixed number of queries regardless of data size", async () => {
    const client = (db as unknown as { $client: Client }).$client;
    const execute = vi.spyOn(client, "execute");
    const count = async () => {
      execute.mockClear();
      await getCalendar(NOV, { papers: true });
      return execute.mock.calls.length;
    };
    const empty = await count();
    // 4 app-date queries + 1 read of the saved settings (app_settings).
    expect(empty).toBe(5);
    await seed();
    await db.insert(seminars).values(
      Array.from({ length: 40 }, (_, i) => ({
        id: `bulk${i}`,
        title: `세미나 ${i}`,
        date: `2026-11-${String((i % 28) + 1).padStart(2, "0")}`,
        ...ts,
      })),
    );
    expect(await count()).toBe(empty);
    execute.mockRestore();
  });
});

describe("periodsIn", () => {
  it("lists every period touching the range", () => {
    expect(periodsIn("week", { from: "2026-11-01", to: "2026-11-09" })).toEqual([
      "2026-W44",
      "2026-W45",
      "2026-W46",
    ]);
    expect(periodsIn("month", { from: "2026-12-28", to: "2027-01-03" })).toEqual([
      "2026-12",
      "2027-01",
    ]);
    expect(periodsIn("quarter", NOV)).toEqual(["2026-Q4"]);
  });
});
