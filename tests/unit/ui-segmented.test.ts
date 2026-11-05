// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Segmented } from "@/components/ui/Segmented";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type V = "a" | "b" | "c";
const OPTIONS = [
  { value: "a", label: "에이" },
  { value: "b", label: "비" },
  { value: "c", label: "씨" },
] as const;
let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
});

async function setup(initial: V | null) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  function Host() {
    const [value, setValue] = useState<V | null>(initial);
    return createElement(Segmented<V>, {
      options: OPTIONS,
      value,
      onChange: setValue,
      ariaLabel: "보기",
    });
  }
  await act(async () => root!.render(createElement(Host)));
  const radio = (name: string) =>
    [...host!.querySelectorAll<HTMLElement>('[role="radio"]')].find((r) => r.textContent === name)!;
  const key = (target: HTMLElement, k: string) =>
    act(async () => {
      target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
      // Radix roving focus moves focus on a 0 ms timer.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  return { radio, key };
}

describe("Segmented", () => {
  it("is a named radiogroup with the value checked", async () => {
    const t = await setup("b");
    const group = host!.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute("aria-label")).toBe("보기");
    expect(t.radio("비").getAttribute("aria-checked")).toBe("true");
    expect(t.radio("에이").getAttribute("aria-checked")).toBe("false");
  });

  it("checks an option on click", async () => {
    const t = await setup(null);
    await act(async () => t.radio("씨").click());
    expect(t.radio("씨").getAttribute("aria-checked")).toBe("true");
  });

  it("moves and selects with arrow keys, wrapping", async () => {
    const t = await setup("c");
    act(() => t.radio("씨").focus());
    await t.key(t.radio("씨"), "ArrowRight");
    expect(document.activeElement).toBe(t.radio("에이"));
    expect(t.radio("에이").getAttribute("aria-checked")).toBe("true");
    await t.key(t.radio("에이"), "ArrowUp");
    expect(t.radio("씨").getAttribute("aria-checked")).toBe("true");
  });
});
