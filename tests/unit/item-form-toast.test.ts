// @vitest-environment jsdom
import { act, createElement, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/_actions/result";
import { AUTOSAVE_DELAY, ItemForm, SAVED_TOAST_MS } from "@/components/fields/ItemForm";
import { AppToaster } from "@/components/ui/Toast";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/notes/1",
}));

const Form = ItemForm as (
  props: Omit<ComponentProps<typeof ItemForm>, "children"> & { children?: ReactNode },
) => ReactNode;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  vi.useRealTimers();
});

/** Edit form whose saves resolve at once (`ok` decides the result). */
async function setup(ok = true) {
  const action = vi.fn(async (): Promise<ActionResult<{ id: string }>> =>
    ok ? { ok, data: { id: "1" } } : { ok, error: "실패" },
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    // Toasts render into sonner's viewport, mounted first as in the root layout.
    root!.render(
      createElement(
        "div",
        null,
        createElement(AppToaster),
        createElement(
          Form,
          { mode: "edit", action, basePath: "/notes", backLabel: "노트" },
          createElement("input", { name: "title", defaultValue: "옛 제목" }),
        ),
      ),
    );
  });
  const title = host.querySelector<HTMLInputElement>('input[name="title"]')!;
  const toasts = () =>
    [...document.querySelectorAll('[role="status"]')].filter(
      (el) => el.textContent === "저장되었습니다",
    );
  return {
    action,
    toasts,
    async type(value: string) {
      await act(async () => {
        title.value = value;
        title.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
    async wait(ms: number) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
    },
    /** Let sonner finish removing a dismissed toast (several steps, each its own act). */
    async settle() {
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(250);
        });
      }
    },
    async clickSave() {
      await act(async () => {
        host!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await vi.advanceTimersByTimeAsync(0);
      });
      // sonner adds the toast on a 0 ms timer after the save commits.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    },
    async pressModS() {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true }));
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    },
  };
}

describe("ItemForm saved toast", () => {
  it("shows 저장되었습니다 top right after 저장, then hides it", async () => {
    const f = await setup();
    await f.type("새 제목");
    await f.clickSave();
    expect(f.action).toHaveBeenCalledTimes(1);
    const [toast] = f.toasts();
    expect(toast).toBeDefined();
    // Top right of the viewport (AppToaster's top offset clears the header's buttons).
    const item = toast!.closest("[data-sonner-toast]");
    expect(item?.getAttribute("data-y-position")).toBe("top");
    expect(item?.getAttribute("data-x-position")).toBe("right");
    await f.wait(SAVED_TOAST_MS + 10);
    await f.settle();
    expect(f.toasts()).toHaveLength(0);
  });

  it("shows it after Cmd+S, even when autosave already stored everything", async () => {
    const f = await setup();
    await f.type("새 제목");
    await f.wait(AUTOSAVE_DELAY + 10);
    expect(f.action).toHaveBeenCalledTimes(1);
    expect(f.toasts()).toHaveLength(0);
    await f.pressModS();
    expect(f.toasts()).toHaveLength(1);
  });

  it("never shows it for autosave", async () => {
    const f = await setup();
    await f.type("하나");
    await f.wait(AUTOSAVE_DELAY + 10);
    await f.type("둘");
    await f.wait(AUTOSAVE_DELAY + 10);
    expect(f.action).toHaveBeenCalledTimes(2);
    expect(f.toasts()).toHaveLength(0);
  });

  it("keeps one toast over repeated saves and restarts its timer", async () => {
    const f = await setup();
    await f.clickSave();
    await f.wait(SAVED_TOAST_MS - 500);
    await f.clickSave();
    expect(f.toasts()).toHaveLength(1);
    await f.wait(SAVED_TOAST_MS - 500); // past the first timer
    expect(f.toasts()).toHaveLength(1);
    await f.wait(600);
    await f.settle();
    expect(f.toasts()).toHaveLength(0);
  });

  it("shows no toast when the save fails; the header says 저장 실패", async () => {
    const f = await setup(false);
    await f.type("새 제목");
    await f.clickSave();
    expect(f.toasts()).toHaveLength(0);
    expect(host!.querySelector('[data-state="error"]')?.textContent).toBe("저장 실패");
  });
});
