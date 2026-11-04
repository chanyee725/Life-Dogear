import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_actions/tasks", () => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  moveTask: vi.fn(),
  moveTaskAfter: vi.fn(),
  restoreTask: vi.fn(),
  updateTask: vi.fn(),
}));
import { TaskSection } from "@/components/tasks/TaskSection";
import { projects, tasks } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("today is the Seoul day", () => {
  it("TaskSection: 2026-11-03 16:30 UTC is already the 4th in Seoul", async () => {
    const project = await projects.create({ title: "프로젝트" });
    await tasks.create({
      title: "마감 오늘",
      parent: { type: "project", id: project.id },
      dueDate: "2026-11-04",
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-03T16:30:00Z"));
    const html = renderToStaticMarkup(
      await TaskSection({ parent: { type: "project", id: project.id } }),
    );
    // A UTC "today" (the 3rd) would say 내일.
    expect(html).toContain(">오늘<");
    expect(html).not.toContain(">내일<");
  });

  it("no screen reads the server-zone date any more", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !path.endsWith(join("tasks", "format.ts"))) {
          if (/\blocalDate\(/.test(readFileSync(path, "utf8"))) hits.push(path);
        }
      }
    };
    walk("src");
    expect(hits).toEqual([]);
  });
});
