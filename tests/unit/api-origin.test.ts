import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "@/app/api/papers/_lib/origin";

const check = (headers: Record<string, string>) => isSameOriginRequest(new Headers(headers));

describe("isSameOriginRequest", () => {
  it("allows same-origin browser requests", () => {
    expect(
      check({
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
      }),
    ).toBe(true);
    expect(check({ host: "LOCALHOST:3000", origin: "http://localhost:3000" })).toBe(true);
  });

  it("allows requests without browser headers", () => {
    expect(check({ host: "localhost:3000" })).toBe(true);
    expect(check({ host: "localhost:3000", "sec-fetch-site": "none" })).toBe(true);
  });

  it("rejects cross-site requests", () => {
    expect(check({ host: "localhost:3000", "sec-fetch-site": "cross-site" })).toBe(false);
    expect(check({ host: "localhost:3000", "sec-fetch-site": "same-site" })).toBe(false);
    expect(check({ host: "localhost:3000", origin: "http://evil.example" })).toBe(false);
    expect(check({ host: "localhost:3000", origin: "http://localhost:4000" })).toBe(false);
    expect(check({ host: "localhost:3000", origin: "null" })).toBe(false);
    expect(check({ origin: "http://localhost:3000" })).toBe(false);
    expect(
      check({
        host: "localhost:3000",
        origin: "http://evil.example",
        "sec-fetch-site": "same-origin",
      }),
    ).toBe(false);
  });
});
