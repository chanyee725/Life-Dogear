import { describe, expect, it } from "vitest";
import {
  formText,
  itemRoute,
  optionalEnum,
  optionalInt,
  optionalNullableText,
  optionalStringList,
  optionalText,
  parseItemRef,
} from "@/app/_actions/parse";
import { describeError, toFailure, GENERIC_ERROR } from "@/app/_actions/result";
import { READ_STATUS } from "@/lib/enums";
import { RepoError } from "@/lib/repo";

describe("action input parsers", () => {
  it("parses item refs", () => {
    const uuid = "123e4567-e89b-42d3-a456-426614174000";
    expect(parseItemRef({ type: "paper", id: uuid })).toEqual({ type: "paper", id: uuid });
    expect(parseItemRef({ type: "paper", id: "seed-paper-1" })).toEqual({
      type: "paper",
      id: "seed-paper-1",
    });
    for (const bad of [
      undefined,
      "paper",
      { type: "paper" },
      { type: "x", id: "1" },
      { type: "paper", id: "" },
      { type: "paper", id: ` ${uuid}` },
      { type: "paper", id: "../etc" },
      { type: "paper", id: uuid.toUpperCase() },
    ]) {
      expect(() => parseItemRef(bad)).toThrow(RepoError);
    }
    expect(itemRoute({ type: "seminar" })).toBe("/seminars/[id]");
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
    expect(optionalInt(" 2024 ", "연도")).toBe(2024);
    expect(optionalInt("   ", "연도")).toBeNull();
    expect(optionalInt(null, "연도")).toBeNull();
    expect(optionalInt(-3, "연도")).toBe(-3);
    for (const bad of ["20.5", "1e3", "0x10", "+5", "12abc", "Infinity"]) {
      expect(() => optionalInt(bad, "연도")).toThrow(RepoError);
    }
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

  it("hides unexpected errors and logs only their kind", () => {
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => logged.push(args);
    const err = Object.assign(new Error("Failed query: insert … params: 비밀 메모"), {
      code: "SQLITE_BUSY",
    });
    expect(toFailure(err)).toEqual({ ok: false, error: GENERIC_ERROR });
    console.error = original;
    expect(logged).toEqual([["[action] unexpected error", "Error(SQLITE_BUSY)"]]);
    expect(describeError(new TypeError("x"))).toBe("TypeError");
    expect(describeError("boom")).toBe("unknown error");
    expect(toFailure(new RepoError("invalid", "제목을 입력하세요."))).toEqual({
      ok: false,
      error: "제목을 입력하세요.",
    });
  });
});
