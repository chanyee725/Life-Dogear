import { describe, expect, it } from "vitest";
import { parseProgressInput } from "@/app/api/papers/_lib/progress-input";

const body = (value: unknown) => JSON.stringify(value);

describe("parseProgressInput", () => {
  it("accepts valid positions", () => {
    expect(parseProgressInput(body({ page: 3, scroll: 0.25, totalPages: 10 }))).toEqual({
      page: 3,
      scroll: 0.25,
      totalPages: 10,
    });
    expect(parseProgressInput(body({ page: 1, scroll: 0 }))).toEqual({ page: 1, scroll: 0 });
    expect(parseProgressInput(body({ page: 10, scroll: 1, totalPages: null }))).toEqual({
      page: 10,
      scroll: 1,
    });
  });

  it.each([
    "",
    "not json",
    "null",
    "[]",
    body({ scroll: 0.5 }),
    body({ page: 0, scroll: 0.5 }),
    body({ page: 1.5, scroll: 0.5 }),
    body({ page: "2", scroll: 0.5 }),
    body({ page: 2 }),
    body({ page: 2, scroll: -0.1 }),
    body({ page: 2, scroll: 1.1 }),
    body({ page: 2, scroll: "0.5" }),
    body({ page: 2, scroll: 0.5, totalPages: 0 }),
    body({ page: 5, scroll: 0.5, totalPages: 4 }),
    body({ page: 1_000_000, scroll: 0 }),
    body({ page: 1, scroll: 0, pad: "x".repeat(2000) }),
  ])("rejects %s", (raw) => {
    expect(parseProgressInput(raw)).toBeNull();
  });
});
