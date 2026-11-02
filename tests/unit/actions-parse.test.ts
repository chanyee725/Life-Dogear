import { describe, expect, it } from "vitest";
import {
  formText,
  itemPath,
  optionalEnum,
  optionalInt,
  optionalNullableText,
  optionalStringList,
  optionalText,
  parseItemRef,
} from "@/app/_actions/parse";
import { toFailure, GENERIC_ERROR } from "@/app/_actions/result";
import { READ_STATUS } from "@/lib/enums";
import { RepoError } from "@/lib/repo";

describe("action input parsers", () => {
  it("parses item refs", () => {
    expect(parseItemRef({ type: "paper", id: " a1 " })).toEqual({ type: "paper", id: "a1" });
    for (const bad of [
      undefined,
      "paper",
      { type: "paper" },
      { type: "x", id: "1" },
      { type: "paper", id: "" },
    ]) {
      expect(() => parseItemRef(bad)).toThrow(RepoError);
    }
    expect(itemPath({ type: "seminar", id: "s1" })).toBe("/seminars/s1");
  });

  it("passes undefined through and normalizes null", () => {
    expect(optionalText(undefined, "본문")).toBeUndefined();
    expect(optionalText(null, "본문")).toBe("");
    expect(() => optionalText(3, "본문")).toThrow(RepoError);
    expect(() => optionalText("x".repeat(11), "본문", 10)).toThrow(RepoError);
    expect(optionalNullableText("", "날짜")).toBeNull();
    expect(optionalNullableText("2026-01-01", "날짜")).toBe("2026-01-01");
  });

  it("parses ints, enums and string lists", () => {
    expect(optionalInt("2024", "연도")).toBe(2024);
    expect(optionalInt("", "연도")).toBeNull();
    expect(() => optionalInt("20.5", "연도")).toThrow(RepoError);
    expect(() => optionalInt({}, "연도")).toThrow(RepoError);
    expect(optionalEnum(READ_STATUS, "done", "상태")).toBe("done");
    expect(() => optionalEnum(READ_STATUS, "nope", "상태")).toThrow(RepoError);
    expect(optionalStringList("a, b,\nc,,", "저자")).toEqual(["a", "b", "c"]);
    expect(optionalStringList(["a ", ""], "저자")).toEqual(["a"]);
    expect(() => optionalStringList("not-array" as unknown as object, "저자")).not.toThrow();
    expect(() => optionalStringList({ a: 1 }, "저자")).toThrow(RepoError);
    expect(() => optionalStringList([1], "저자")).toThrow(RepoError);
  });

  it("reads text form fields and rejects files", () => {
    const form = new FormData();
    form.set("title", "제목");
    form.set("file", new Blob(["x"]), "x.txt");
    expect(formText(form, "title")).toBe("제목");
    expect(formText(form, "missing")).toBeUndefined();
    expect(() => formText(form, "file")).toThrow(RepoError);
  });

  it("hides unexpected errors behind a generic message", () => {
    const spy = console.error;
    console.error = () => {};
    expect(toFailure(new Error("db exploded"))).toEqual({ ok: false, error: GENERIC_ERROR });
    console.error = spy;
    expect(toFailure(new RepoError("invalid", "제목을 입력하세요."))).toEqual({
      ok: false,
      error: "제목을 입력하세요.",
    });
  });
});
