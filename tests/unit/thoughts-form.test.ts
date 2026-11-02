import { describe, expect, it } from "vitest";
import { parseThoughtForm } from "@/app/thoughts/form";

function form(entries: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("parseThoughtForm", () => {
  it("reads every field", () => {
    expect(
      parseThoughtForm(
        form([
          ["title", "표본 편향 질문"],
          ["kind", "question"],
          ["maturity", "growing"],
          ["body", "왜?"],
          ["tags", "방법론"],
        ]),
      ),
    ).toEqual({
      title: "표본 편향 질문",
      kind: "question",
      maturity: "growing",
      body: "왜?",
      tags: ["방법론"],
    });
  });

  it("rejects unknown kind and maturity values", () => {
    expect(() =>
      parseThoughtForm(
        form([
          ["title", "x"],
          ["kind", "rant"],
        ]),
      ),
    ).toThrow("종류");
    expect(() =>
      parseThoughtForm(
        form([
          ["title", "x"],
          ["maturity", "ripe"],
        ]),
      ),
    ).toThrow("발전 정도");
  });
});
