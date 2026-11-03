import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGraph } from "@/components/graph/api";

function withMockUrl() {
  vi.stubGlobal("window", { location: { search: "?mock=50" } });
  const fetchSpy = vi.fn(async () => Response.json({ nodes: [], edges: [], positions: [] }));
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("graph client ?mock=", () => {
  it("serves the mock in development without calling the API", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchSpy = withMockUrl();
    const load = await fetchGraph({});
    expect(load.mock).toBe(true);
    expect(load.nodes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores it in production and calls the API", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchSpy = withMockUrl();
    const load = await fetchGraph({});
    expect(load.mock).toBe(false);
    expect(fetchSpy).toHaveBeenCalledWith("/api/graph", expect.anything());
  });
});
