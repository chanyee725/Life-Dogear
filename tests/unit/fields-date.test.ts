// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateField, type DateFieldProps } from "@/components/fields/DateField";
import { dateToIso, isoToDate, parseDateInput } from "@/components/fields/date-input";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("parseDateInput", () => {
  it("reads YYYY.MM.DD and the other separators as ISO", () => {
    expect(parseDateInput("2026.11.04")).toBe("2026-11-04");
    expect(parseDateInput("2026-11-04")).toBe("2026-11-04");
    expect(parseDateInput("2026/11/04")).toBe("2026-11-04");
    expect(parseDateInput("20261104")).toBe("2026-11-04");
    expect(parseDateInput(" 2026.11.04. ")).toBe("2026-11-04");
  });

  it("gives '' for blank (cleared)", () => {
    expect(parseDateInput("")).toBe("");
    expect(parseDateInput("   ")).toBe("");
  });

  it("waits for two-digit month and day while typing", () => {
    expect(parseDateInput("2026.11.1")).toBeNull();
    expect(parseDateInput("2026.11.")).toBeNull();
    expect(parseDateInput("2026.1.5", true)).toBe("2026-01-05");
  });

  it("rejects dates that do not exist", () => {
    expect(parseDateInput("2026.02.30")).toBeNull();
    expect(parseDateInput("2026.13.01")).toBeNull();
    expect(parseDateInput("2026.11.00")).toBeNull();
    expect(parseDateInput("2028.02.29")).toBe("2028-02-29");
    expect(parseDateInput("abc")).toBeNull();
  });
});

describe("isoToDate / dateToIso", () => {
  it("round-trips without a timezone shift", () => {
    const date = isoToDate("2026-11-04")!;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 10, 4]);
    expect(dateToIso(date)).toBe("2026-11-04");
    expect(isoToDate("")).toBeUndefined();
    expect(isoToDate(null)).toBeUndefined();
  });
});

describe("DateField", () => {
  let root: Root | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
  });

  async function mount(props: DateFieldProps) {
    const form = document.createElement("form");
    document.body.appendChild(form);
    root = createRoot(form);
    await act(async () => root!.render(createElement(DateField, { "aria-label": "날짜", ...props })));
    return form;
  }
  const field = () => document.querySelector<HTMLInputElement>("input[aria-label=날짜]")!;
  const type = (value: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(field(), value);
    field().dispatchEvent(new Event("input", { bubbles: true }));
  };

  it("shows YYYY.MM.DD and posts ISO through the form", async () => {
    const form = await mount({ name: "due", defaultValue: "2026-11-04" });
    expect(field().value).toBe("2026.11.04");
    expect(new FormData(form).get("due")).toBe("2026-11-04");

    await act(async () => type("2026.12.25"));
    expect(new FormData(form).get("due")).toBe("2026-12-25");
  });

  it("emits ISO once the typed date is complete, and '' when cleared", async () => {
    const onChange = vi.fn();
    await mount({ value: "2026-11-04", onChange });
    await act(async () => type("2026.11.1"));
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => type("2026.11.15"));
    expect(onChange).toHaveBeenLastCalledWith("2026-11-15");
    await act(async () => type(""));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("puts back the last good date when an invalid one is left on blur", async () => {
    const form = await mount({ name: "due", defaultValue: "2026-11-04" });
    await act(async () => type("2026.02.30"));
    await act(async () => field().dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    expect(field().value).toBe("2026.11.04");
    expect(new FormData(form).get("due")).toBe("2026-11-04");
  });
});
