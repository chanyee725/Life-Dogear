import { describe, expect, it } from "vitest";
import { parseSeminarForm } from "@/app/seminars/form";

function form(entries: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("parseSeminarForm", () => {
  it("reads every field", () => {
    expect(
      parseSeminarForm(
        form([
          ["title", "인과추론 세미나"],
          ["date", "2026-10-30"],
          ["speaker", "가상 연사"],
          ["hostVenue", "공학관 301호"],
          ["kind", "talk"],
          ["keyLine", "가정이 결론을 만든다"],
          ["materialUrl", "https://example.com/slides"],
          ["body", "## 현장 메모"],
          ["tags", "인과"],
        ]),
      ),
    ).toEqual({
      title: "인과추론 세미나",
      date: "2026-10-30",
      speaker: "가상 연사",
      hostVenue: "공학관 301호",
      kind: "talk",
      keyLine: "가정이 결론을 만든다",
      materialUrl: "https://example.com/slides",
      body: "## 현장 메모",
      tags: ["인과"],
    });
  });

  it("clears an empty date and rejects unknown kinds", () => {
    expect(
      parseSeminarForm(
        form([
          ["title", "x"],
          ["date", ""],
        ]),
      ).date,
    ).toBeNull();
    expect(() =>
      parseSeminarForm(
        form([
          ["title", "x"],
          ["kind", "party"],
        ]),
      ),
    ).toThrow("종류");
  });
});
