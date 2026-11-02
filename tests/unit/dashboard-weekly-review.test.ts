import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/reviews/actions", () => ({ openReview: vi.fn() }));
import { WeeklyReviewLine } from "@/components/dashboard/WeeklyReviewLine";

const render = (period: string | null, today: Date) =>
  renderToStaticMarkup(createElement(WeeklyReviewLine, { period, today }));

describe("home weekly review line", () => {
  it("is hidden when nothing is due", () => {
    expect(render(null, new Date(2026, 10, 3))).toBe("");
  });

  it("names this week on Sunday and last week on Monday, posting the period", () => {
    const sunday = render("2026-W45", new Date(2026, 10, 8));
    expect(sunday).toContain("이번 주 회고");
    expect(sunday).toContain('value="2026-W45"');
    expect(sunday).toContain('value="week"');
    expect(render("2026-W45", new Date(2026, 10, 9))).toContain("지난주 회고");
  });
});
