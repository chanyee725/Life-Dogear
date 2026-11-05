// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
});

async function mount(el: ReturnType<typeof createElement>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(el));
  // Radix portals the content into document.body.
  return document.querySelector<HTMLElement>('[role="dialog"],[role="alertdialog"]')!;
}

/** The accessible name from aria-labelledby. */
const nameOf = (dialog: HTMLElement) =>
  (dialog.getAttribute("aria-labelledby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
    .trim();

describe("Dialog name", () => {
  it("is named by its title heading", async () => {
    const dialog = await mount(
      createElement(Dialog, { open: true, onClose: () => {}, title: "항목 연결" }),
    );
    expect(nameOf(dialog)).toBe("항목 연결");
    expect(dialog.querySelector("h2")?.id).toBe(dialog.getAttribute("aria-labelledby"));
  });

  it("ConfirmDialog too", async () => {
    const dialog = await mount(
      createElement(ConfirmDialog, {
        open: true,
        onCancel: () => {},
        onConfirm: () => {},
        title: "삭제할까요?",
      }),
    );
    expect(nameOf(dialog)).toBe("삭제할까요?");
  });

  it("ConfirmDialog is an alertdialog; Cancel calls onCancel, confirm calls onConfirm", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const dialog = await mount(
      createElement(ConfirmDialog, { open: true, onCancel, onConfirm, title: "삭제할까요?", confirmLabel: "삭제" }),
    );
    expect(dialog.getAttribute("role")).toBe("alertdialog");
    const button = (name: string) =>
      [...dialog.querySelectorAll("button")].find((b) => b.textContent === name)!;
    await act(async () => button("삭제").click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    await act(async () => button("취소").click());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("an empty title gives no heading and no aria-labelledby", async () => {
    const dialog = await mount(createElement(Dialog, { open: true, onClose: () => {}, title: "" }));
    expect(dialog.hasAttribute("aria-labelledby")).toBe(false);
    expect(dialog.querySelector("h2")).toBeNull();
  });
});
