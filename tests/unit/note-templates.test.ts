import { describe, expect, it } from "vitest";
import { seoulDate } from "@/components/calendar/model";
import { DEFAULT_NOTE_TEMPLATE, NOTE_TEMPLATES, noteTemplate } from "@/lib/templates";

const headings = (md: string) =>
  md
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3));

describe("note templates", () => {
  it("offers five templates in picker order, blank first and by default", () => {
    expect(NOTE_TEMPLATES.map((t) => [t.key, t.name])).toEqual([
      ["blank", "빈 노트"],
      ["worklog", "작업 로그"],
      ["concept", "개념 정리"],
      ["error", "에러 해결"],
      ["summary", "강의·책 요약"],
    ]);
    expect(DEFAULT_NOTE_TEMPLATE).toBe("blank");
    expect(noteTemplate("blank").body("2026-01-01")).toBe("");
    for (const t of NOTE_TEMPLATES) expect(t.description.length).toBeGreaterThan(0);
  });

  it("work log starts with the Seoul date as its first line", () => {
    // 16:30 UTC on Nov 3 is already Nov 4 in Seoul (tests run in UTC).
    const today = seoulDate(new Date("2026-11-03T16:30:00Z"));
    expect(today).toBe("2026-11-04");
    const body = noteTemplate("worklog").body(today);
    expect(body.split("\n")[0]).toBe("## 2026-11-04");
    expect(body).toContain("### 다음에 할 일");
  });

  it("error template has 증상 / 원인 / 해결 / 참고 with code fences", () => {
    const body = noteTemplate("error").body("2026-11-04");
    expect(headings(body)).toEqual(["증상", "원인", "해결", "참고"]);
    expect(body).toContain("```text\n(에러 메시지)\n```");
    expect(body).toContain("```bash\n```");
  });

  it("concept and summary templates start at ## (the note title is the h1)", () => {
    expect(headings(noteTemplate("concept").body(""))[0]).toBe("한 줄 정의");
    expect(headings(noteTemplate("summary").body(""))).toEqual([
      "출처",
      "한 줄 요약",
      "핵심 내용",
      "인상 깊은 부분",
      "내 생각·적용",
      "더 볼 것",
    ]);
    for (const t of NOTE_TEMPLATES) expect(t.body("2026-11-04")).not.toMatch(/^# /m);
  });
});
