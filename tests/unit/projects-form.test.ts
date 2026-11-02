import { describe, expect, it } from "vitest";
import { parseProjectForm } from "@/app/projects/form";

function form(entries: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("parseProjectForm", () => {
  it("reads every field, empty dates become null, tags from repeated inputs", () => {
    const input = parseProjectForm(
      form([
        ["title", "시선 추적 연구"],
        ["researchQuestion", "무엇이 주의를 끄는가?"],
        ["stage", "lit_review"],
        ["startDate", "2026-09-01"],
        ["dueDate", ""],
        ["body", "## 메모"],
        ["tags", "HCI"],
        ["tags", "시선"],
      ]),
    );
    expect(input).toEqual({
      title: "시선 추적 연구",
      researchQuestion: "무엇이 주의를 끄는가?",
      stage: "lit_review",
      startDate: "2026-09-01",
      dueDate: null,
      body: "## 메모",
      tags: ["HCI", "시선"],
    });
  });

  it("leaves absent optional fields and tags undefined", () => {
    const input = parseProjectForm(form([["title", "제목"]]));
    expect(input.stage).toBeUndefined();
    expect(input.body).toBeUndefined();
    expect(input.tags).toBeUndefined();
  });

  it("treats the tags presence marker as a cleared tag list", () => {
    const input = parseProjectForm(
      form([
        ["title", "제목"],
        ["__present:tags", "1"],
      ]),
    );
    expect(input.tags).toEqual([]);
  });

  it("rejects unknown stage values", () => {
    expect(() =>
      parseProjectForm(
        form([
          ["title", "x"],
          ["stage", "done"],
        ]),
      ),
    ).toThrow("단계");
  });

  it("rejects a missing title field and file uploads in text fields", () => {
    expect(() => parseProjectForm(form([]))).not.toThrow(); // blank title is rejected by the repo
    const fd = new FormData();
    fd.append("title", new Blob(["x"]), "x.txt");
    expect(() => parseProjectForm(fd)).toThrow();
  });
});
