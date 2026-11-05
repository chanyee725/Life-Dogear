import { describe, expect, it } from "vitest";
import {
  ACCENT_ATTR,
  ACCENT_STORAGE_KEY,
  ACCENT_VALUES,
  accentInitSnippet,
  applyAccent,
  parseAccent,
  readAccentPreference,
  saveAccentPreference,
} from "@/components/accent";
import { themeInitScript } from "@/components/shell/theme";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function fakeRoot() {
  const attrs = new Map<string, string>();
  return {
    attrs,
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    removeAttribute: (k: string) => void attrs.delete(k),
  };
}

describe("accent preference", () => {
  it("defaults to blue for missing or unknown values", () => {
    expect(parseAccent(null)).toBe("blue");
    expect(parseAccent("pink")).toBe("blue");
    expect(parseAccent("terracotta")).toBe("terracotta");
    expect(parseAccent("mono")).toBe("mono");
  });

  it("saves and applies mono", () => {
    const s = memoryStorage();
    saveAccentPreference("mono", s);
    expect(readAccentPreference(s)).toBe("mono");
    const root = fakeRoot();
    applyAccent("mono", root);
    expect(root.attrs.get(ACCENT_ATTR)).toBe("mono");
    expect(ACCENT_VALUES).toEqual(["blue", "terracotta", "mono"]);
  });

  it("saves terracotta and clears the key for blue", () => {
    const s = memoryStorage();
    saveAccentPreference("terracotta", s);
    expect(s.map.get(ACCENT_STORAGE_KEY)).toBe("terracotta");
    expect(readAccentPreference(s)).toBe("terracotta");
    saveAccentPreference("blue", s);
    expect(s.map.has(ACCENT_STORAGE_KEY)).toBe(false);
    expect(readAccentPreference(s)).toBe("blue");
  });

  it("survives a storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {},
    };
    expect(readAccentPreference(broken)).toBe("blue");
    expect(() => saveAccentPreference("terracotta", broken)).not.toThrow();
  });

  it("sets data-accent for terracotta and removes it for blue", () => {
    const root = fakeRoot();
    applyAccent("terracotta", root);
    expect(root.attrs.get(ACCENT_ATTR)).toBe("terracotta");
    applyAccent("blue", root);
    expect(root.attrs.has(ACCENT_ATTR)).toBe(false);
  });

  it("is applied by the pre-paint theme script", () => {
    expect(themeInitScript).toContain(accentInitSnippet);
    const root = fakeRoot();
    const s = memoryStorage();
    s.setItem(ACCENT_STORAGE_KEY, "terracotta");
    new Function("localStorage", "document", accentInitSnippet)(s, { documentElement: root });
    expect(root.attrs.get(ACCENT_ATTR)).toBe("terracotta");

    const monoRoot = fakeRoot();
    s.setItem(ACCENT_STORAGE_KEY, "mono");
    new Function("localStorage", "document", accentInitSnippet)(s, { documentElement: monoRoot });
    expect(monoRoot.attrs.get(ACCENT_ATTR)).toBe("mono");

    const junkRoot = fakeRoot();
    s.setItem(ACCENT_STORAGE_KEY, "<script>");
    new Function("localStorage", "document", accentInitSnippet)(s, { documentElement: junkRoot });
    expect(junkRoot.attrs.has(ACCENT_ATTR)).toBe(false);
  });
});
