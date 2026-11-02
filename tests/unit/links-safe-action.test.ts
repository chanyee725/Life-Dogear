import { describe, expect, it } from "vitest";
import { NETWORK_ERROR, safeAction } from "@/components/links/safe-action";

describe("safeAction", () => {
  it("passes results through and turns throws into a Korean error", async () => {
    expect(await safeAction(async () => ({ ok: true, data: 1 }))).toEqual({ ok: true, data: 1 });
    expect(await safeAction(async () => ({ ok: false, error: "x" }))).toEqual({
      ok: false,
      error: "x",
    });
    expect(
      await safeAction(async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).toEqual({ ok: false, error: NETWORK_ERROR });
    expect(
      await safeAction(() => Promise.reject(new Error("boom")), "검색하지 못했습니다."),
    ).toEqual({ ok: false, error: "검색하지 못했습니다." });
  });
});
