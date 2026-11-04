import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isAllowedHost, parseAllowedHosts } from "@/lib/host-guard";
import { middleware } from "@/middleware";

describe("host guard", () => {
  it("allows only local hosts by default", () => {
    for (const host of [
      "127.0.0.1:3000",
      "localhost:3000",
      "LOCALHOST:3000",
      "[::1]:3000",
      "localhost",
    ]) {
      expect(isAllowedHost(host)).toBe(true);
    }
    for (const host of [
      null,
      "",
      "evil.example:3000",
      "localhost.evil.example:3000",
      "127.0.0.1.nip.io:3000",
      "192.168.0.10:3000",
      "localhost:abc",
      "localhost:3000@evil.example",
      "[::1]evil:3000",
    ]) {
      expect(isAllowedHost(host)).toBe(false);
    }
  });

  it("accepts extra hosts from ALLOWED_HOSTS", () => {
    const extra = parseAllowedHosts(" my-box.local , Lab-PC:4000 ,, ");
    expect(extra).toEqual(["my-box.local", "lab-pc:4000"]);
    expect(isAllowedHost("my-box.local:3000", extra)).toBe(true);
    expect(isAllowedHost("lab-pc:4000", extra)).toBe(true);
    expect(isAllowedHost("lab-pc:3000", extra)).toBe(false);
  });

  it("middleware returns 403 for foreign hosts and passes local ones", async () => {
    const make = (host: string) =>
      new NextRequest("http://127.0.0.1:3000/_next/static/x.js", { headers: { host } });
    const blocked = await middleware(make("attacker.example:3000"));
    expect(blocked.status).toBe(403);
    expect(await blocked.text()).toContain("허용되지 않은 주소");
    expect((await middleware(make("localhost:3000"))).headers.get("x-middleware-next")).toBe("1");
  });
});
