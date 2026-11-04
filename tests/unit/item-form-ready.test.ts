// @vitest-environment jsdom
import { act, createElement, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/_actions/result";
import { AUTOSAVE_DELAY, ItemForm } from "@/components/fields/ItemForm";
import { EDITOR_READY_EVENT } from "@/components/fields/form-patch";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/notes/1",
}));

// ItemForm with optional children, so they can go to createElement as arguments.
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

describe("ItemForm editor-ready baseline", () => {
  it("saves a body undone to the editor's ready value after a ready that came mid-save", async () => {
    const finishers: (() => void)[] = [];
    const sent: Record<string, string>[] = [];
    const action = vi.fn(
      (form: FormData) =>
        new Promise<ActionResult<{ id: string }>>((resolve) => {
          sent.push(Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])));
          finishers.push(() => resolve({ ok: true, data: { id: "1" } }));
        }),
    );

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(
        createElement(
          Form,
          { mode: "edit", action, basePath: "/notes", backLabel: "노트" },
          createElement("input", { name: "title", defaultValue: "옛 제목" }),
          createElement("input", { type: "hidden", name: "body", defaultValue: "orig" }),
        ),
      );
    });
    const title = host.querySelector<HTMLInputElement>('input[name="title"]')!;
    const body = host.querySelector<HTMLInputElement>('input[name="body"]')!;
    const edit = async (input: HTMLInputElement, value: string) => {
      await act(async () => {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY + 10);
      });
    };
    const finish = async (i: number) => {
      await act(async () => {
        finishers[i]();
        await vi.advanceTimersByTimeAsync(0);
      });
    };

    // Title save A is in flight when the editor reports ready with a normalised body.
    await edit(title, "새 제목");
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => {
      body.value = "orig-norm";
      body.dispatchEvent(new Event(EDITOR_READY_EVENT, { bubbles: true }));
    });
    // The user edits the body; save B waits behind A. Then both finish.
    await edit(body, "USER EDIT");
    await finish(0);
    expect(action).toHaveBeenCalledTimes(2);
    await finish(1);

    // Undo back to the editor's ready body: a real change, so it must be saved.
    await edit(body, "orig-norm");
    expect(action).toHaveBeenCalledTimes(3);
    await finish(2);
    expect(sent.map(({ title, body }) => ({ title, body }))).toEqual([
      { title: "새 제목", body: undefined },
      { title: undefined, body: "USER EDIT" },
      { title: undefined, body: "orig-norm" },
    ]);
  });
});
