import { describe, expect, it } from "vitest";
import {
  isLaterReadAt,
  laterReadAt,
  newerRemotePosition,
  parseRemoteProgress,
  type RemoteProgress,
} from "@/components/pdf/remote-progress";

const remote = (over: Partial<RemoteProgress> = {}): RemoteProgress => ({
  page: 7,
  scroll: 0.25,
  totalPages: 10,
  lastReadAt: "2026-11-02T05:00:00.000Z",
  ...over,
});

describe("newerRemotePosition", () => {
  const stale = "2026-11-02T04:00:00.000Z";

  it("jumps when the server was read later (e.g. a back navigation showed old props)", () => {
    expect(newerRemotePosition(remote(), stale, { page: 3, scroll: 0 }, false)).toEqual({
      page: 7,
      scroll: 0.25,
    });
    expect(newerRemotePosition(remote(), null, null, false)).toEqual({ page: 7, scroll: 0.25 });
  });

  it("stays when the server is not newer", () => {
    expect(newerRemotePosition(remote(), "2026-11-02T05:00:00.000Z", null, false)).toBeNull();
    expect(newerRemotePosition(remote(), "2026-11-02T06:00:00.000Z", null, false)).toBeNull();
    expect(newerRemotePosition(remote({ lastReadAt: null }), stale, null, false)).toBeNull();
  });

  it("stays when the user has an unsaved position or is already there", () => {
    expect(newerRemotePosition(remote(), stale, { page: 3, scroll: 0 }, true)).toBeNull();
    expect(newerRemotePosition(remote(), stale, { page: 7, scroll: 0.25 }, false)).toBeNull();
  });

  it("ignores servers without a saved page", () => {
    expect(newerRemotePosition(remote({ page: null }), stale, null, false)).toBeNull();
  });

  it("treats a missing scroll as the page top", () => {
    expect(newerRemotePosition(remote({ scroll: null }), stale, null, false)).toEqual({
      page: 7,
      scroll: 0,
    });
  });
});

describe("read timestamps", () => {
  it("compares ISO timestamps", () => {
    expect(isLaterReadAt("2026-11-02T05:00:00Z", "2026-11-02T04:59:59Z")).toBe(true);
    expect(isLaterReadAt("2026-11-02T05:00:00Z", null)).toBe(true);
    expect(isLaterReadAt(null, null)).toBe(false);
    expect(isLaterReadAt("garbage", null)).toBe(false);
    expect(laterReadAt("2026-11-02T04:00:00Z", "2026-11-02T05:00:00Z")).toBe(
      "2026-11-02T05:00:00Z",
    );
    expect(laterReadAt("2026-11-02T06:00:00Z", null)).toBe("2026-11-02T06:00:00Z");
  });
});

describe("parseRemoteProgress", () => {
  it("normalises the response body", () => {
    expect(parseRemoteProgress({ page: 2, scroll: 0.5, totalPages: 9, lastReadAt: "x" })).toEqual({
      page: 2,
      scroll: 0.5,
      totalPages: 9,
      lastReadAt: "x",
    });
    expect(parseRemoteProgress({ page: "2" })).toEqual({
      page: null,
      scroll: null,
      totalPages: null,
      lastReadAt: null,
    });
    expect(parseRemoteProgress(null)).toBeNull();
  });
});
