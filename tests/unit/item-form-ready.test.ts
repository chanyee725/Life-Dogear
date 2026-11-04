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

/**
 * Renders an edit form with a title input and the editor's hidden body input (server
 * body "orig"). Saves stay in flight until `finish(i)` ends the i-th one.
 */
async function setup() {
  const finishers: ((ok: boolean) => void)[] = [];
  const sent: { title?: string; body?: string }[] = [];
  const action = vi.fn(
    (form: FormData) =>
      new Promise<ActionResult<{ id: string }>>((resolve) => {
        const entries = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
        sent.push({ title: entries.title, body: entries.body });
        finishers.push((ok) => resolve(ok ? { ok, data: { id: "1" } } : { ok, error: "실패" }));
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
  return {
    action,
    sent,
    title,
    body,
    /** Types a value and lets the autosave debounce run. */
    async edit(input: HTMLInputElement, value: string) {
      await act(async () => {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY + 10);
      });
    },
    /** The editor loads and re-serialises the body. */
    async ready(value: string) {
      await act(async () => {
        body.value = value;
        body.dispatchEvent(new Event(EDITOR_READY_EVENT, { bubbles: true }));
      });
    },
    async finish(i: number, ok = true) {
      await act(async () => {
        finishers[i](ok);
        await vi.advanceTimersByTimeAsync(0);
      });
    },
  };
}

describe("ItemForm editor-ready baseline", () => {
  it("saves a body undone to the editor's ready value after a ready that came mid-save", async () => {
    const f = await setup();
    // Title save A is in flight when the editor reports ready with a normalised body.
    await f.edit(f.title, "새 제목");
    expect(f.action).toHaveBeenCalledTimes(1);
    await f.ready("orig-norm");
    // The user edits the body; save B waits behind A. Then both finish.
    await f.edit(f.body, "USER EDIT");
    await f.finish(0);
    expect(f.action).toHaveBeenCalledTimes(2);
    await f.finish(1);
    // Undo back to the editor's ready body: a real change, so it must be saved.
    await f.edit(f.body, "orig-norm");
    expect(f.action).toHaveBeenCalledTimes(3);
    await f.finish(2);
    expect(f.sent).toEqual([
      { title: "새 제목", body: undefined },
      { title: undefined, body: "USER EDIT" },
      { title: undefined, body: "orig-norm" },
    ]);
  });

  it("keeps the held ready body out of a title-only save that follows it", async () => {
    const f = await setup();
    await f.edit(f.title, "t2");
    await f.ready("orig-norm");
    // Only the title changes again: the DOM body is the editor's, not the user's.
    await f.edit(f.title, "t3");
    await f.finish(0);
    await f.finish(1);
    await f.edit(f.title, "t4");
    await f.finish(2);
    expect(f.sent).toEqual([
      { title: "t2", body: undefined },
      { title: "t3", body: undefined },
      { title: "t4", body: undefined },
    ]);
  });

  it("keeps the ready body out of the retry after a failed save", async () => {
    const f = await setup();
    await f.edit(f.title, "t2");
    await f.ready("orig-norm");
    await f.finish(0, false);
    // The next read retries the title; the body still is the editor's.
    await f.edit(f.title, "t3");
    await f.finish(1);
    await f.edit(f.title, "t4");
    await f.finish(2);
    expect(f.sent).toEqual([
      { title: "t2", body: undefined },
      { title: "t3", body: undefined },
      { title: "t4", body: undefined },
    ]);
  });

  it("holds a ready that comes again after the held body was dropped", async () => {
    const f = await setup();
    await f.edit(f.title, "t2");
    await f.ready("orig-norm");
    await f.edit(f.body, "USER EDIT"); // drops the held body; save B waits
    await f.ready("USER EDIT norm"); // the editor re-serialises the user's body
    await f.finish(0);
    await f.finish(1);
    await f.edit(f.title, "t3");
    await f.finish(2);
    expect(f.sent).toEqual([
      { title: "t2", body: undefined },
      { title: undefined, body: "USER EDIT" },
      { title: "t3", body: undefined },
    ]);
  });
});
