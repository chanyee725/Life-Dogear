// @vitest-environment jsdom
import { act, createElement, useState, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppToaster, Toast } from "@/components/ui/Toast";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MS = 2500;
// sonner adds a toast on a 0 ms timer; after onDone it removes it in steps (dismiss →
// exit animation → unmount), each committed only when an act ends, so `settle` uses several.
const EXIT_STEPS = 3;
// Toast with optional children, so they can go to createElement as arguments.
const T = Toast as (
  props: Omit<ComponentProps<typeof Toast>, "children"> & { children?: ReactNode },
) => ReactNode;
let root: Root | undefined;
let host: HTMLDivElement | undefined;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  vi.useRealTimers();
});

function Host() {
  const [shown, setShown] = useState(true);
  // The toast renders into sonner's viewport (subscribed first), as in the root layout.
  return createElement(
    "div",
    null,
    createElement(AppToaster),
    shown ? createElement(T, { ms: MS, onDone: () => setShown(false) }, "저장되었습니다") : null,
  );
}

async function setup() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(Host)));
  await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
  const toast = () => document.querySelector<HTMLElement>('[role="status"]');
  const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
  // React listens for mouseover/mouseout (mouseenter/leave are derived from them).
  const fire = (type: string, target: Element | null = toast(), related: Element | null = null) =>
    act(async () => {
      const init = { bubbles: true, relatedTarget: related };
      target!.dispatchEvent(
        type.startsWith("focus") ? new FocusEvent(type, init) : new MouseEvent(type, init),
      );
    });
  const settle = async () => {
    for (let i = 0; i < EXIT_STEPS; i++) await wait(250);
  };
  return { toast, wait, fire, settle };
}

describe("Toast", () => {
  it("stays while hovered past its time, then counts again on leave", async () => {
    const t = await setup();
    await t.fire("mouseover", t.toast(), document.body);
    await t.wait(MS + 500);
    expect(t.toast()?.textContent).toBe("저장되었습니다");
    await t.fire("mouseout", t.toast(), document.body);
    await t.wait(MS - 100);
    expect(t.toast()).not.toBeNull();
    await t.wait(200);
    await t.settle();
    expect(t.toast()).toBeNull();
  });

  it("stays while focus is inside, then counts again on blur", async () => {
    const t = await setup();
    await t.fire("focusin");
    await t.wait(MS + 500);
    expect(t.toast()).not.toBeNull();
    await t.fire("focusout");
    await t.wait(MS + 10);
    await t.settle();
    expect(t.toast()).toBeNull();
  });
});
