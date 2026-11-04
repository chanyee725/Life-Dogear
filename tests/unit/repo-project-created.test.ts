import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seoulDate } from "@/components/calendar/model";
import { formatDate } from "@/components/ui";
import { projects } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("project createdAt", () => {
  it("keeps the stored createdAt when the project is edited", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T15:30:00.000Z"));
    const created = await projects.create({ title: "연구" });
    expect(created.createdAt).toBe("2026-11-01T15:30:00.000Z");

    vi.setSystemTime(new Date("2026-11-04T03:00:00.000Z"));
    const edited = await projects.update(created.id, {
      title: "연구 2",
      kind: "general",
      status: "done",
      body: "본문",
      tags: ["a"],
    });
    expect(edited?.createdAt).toBe(created.createdAt);
    expect(edited?.updatedAt).toBe("2026-11-04T03:00:00.000Z");
    expect((await projects.get(created.id))?.createdAt).toBe(created.createdAt);
  });

  it("shows the Seoul date, not the UTC one", () => {
    // 2026-11-01 15:30 UTC is 2026-11-02 00:30 in Seoul.
    expect(formatDate(seoulDate("2026-11-01T15:30:00.000Z"))).toBe("2026.11.02");
  });
});
