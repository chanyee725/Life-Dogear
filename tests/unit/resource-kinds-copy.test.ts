import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Lines that list 논문·세미나 as kinds of 자료 without 노트 (단계 N). Allowed: lines that
 * mention papers and seminars for another reason.
 */
const ALLOWED: { file: string; text: string }[] = [
  // Recommended area standard: an example sentence, not a list of item kinds.
  { file: join("src", "lib", "enums.ts"), text: "관심 분야의 새 논문·세미나를 꾸준히 따라간다." },
  // The area detail page shows notes in a separate section, so its materials title leaves notes out.
  { file: join("src", "app", "areas", "[id]", "page.tsx"), text: "논문·세미나·생각" },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

describe("자료 kind lists in the copy", () => {
  it("never list 논문·세미나 without 노트", () => {
    const hits: string[] = [];
    for (const path of walk("src")) {
      readFileSync(path, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (!line.includes("논문·세미나") || line.includes("노트")) return;
          if (ALLOWED.some((a) => a.file === path && line.includes(a.text))) return;
          hits.push(`${path}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it("still allows the recommended-area example sentence", () => {
    const enums = readFileSync(ALLOWED[0]!.file, "utf8");
    expect(enums).toContain(ALLOWED[0]!.text);
  });
});
