import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config", () => {
  it("does not log fetch URLs (private calendar addresses would show)", () => {
    const logging = nextConfig.logging as { fetches?: unknown } | false | undefined;
    expect(logging ? logging.fetches : undefined).toBeUndefined();
  });
});
