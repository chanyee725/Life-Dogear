// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddEventButton } from "@/components/calendar/AddEventButton";
import {
  ADDED,
  addEventError,
  checkEvent,
  eventPayload,
  mergeAdded,
  postEvent,
} from "@/components/calendar/add-event";
import type { CalendarItem } from "@/lib/calendar/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ITEM: CalendarItem = {
  id: "google:abc@google.com:2026-11-05T14:00:00+09:00",
  source: "google",
  title: "회의",
  start: "2026-11-05T14:00:00+09:00",
  end: "2026-11-05T15:00:00+09:00",
  allDay: false,
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const base = { title: "회의", date: "2026-11-05", start: "", end: "" };

describe("add-event helpers", () => {
  it("payload drops blank times and an end without a start", () => {
    expect(eventPayload({ ...base, title: " 회의 " })).toEqual({
      title: "회의",
      date: "2026-11-05",
    });
    expect(eventPayload({ ...base, start: "14:00", end: "15:00" })).toEqual({
      title: "회의",
      date: "2026-11-05",
      start: "14:00",
      end: "15:00",
    });
    expect(eventPayload({ ...base, end: "15:00" })).not.toHaveProperty("end");
  });

  it("checks title, date and time order", () => {
    expect(checkEvent(base)).toBeNull();
    expect(checkEvent({ ...base, title: " " })).toBe("제목을 입력하세요.");
    expect(checkEvent({ ...base, date: "" })).toBe("날짜를 고르세요.");
    expect(checkEvent({ ...base, start: "15:00", end: "14:00" })).toMatch(/자정/);
  });

  it("maps error codes to short notices", () => {
    expect(addEventError("not_configured")).toMatch(/설정/);
    expect(addEventError("auth")).toMatch(/만료/);
    expect(addEventError("network")).toMatch(/연결하지 못했/);
    expect(addEventError("invalid")).toBe("입력을 확인하세요.");
    expect(addEventError("로그인이 필요합니다.")).toBe("일정을 추가하지 못했습니다.");
    expect(addEventError(undefined)).toBe("일정을 추가하지 못했습니다.");
  });

  it("postEvent returns the item or a message, never throws", async () => {
    const ok = vi.fn(async () => json(201, { item: ITEM }));
    expect(
      await postEvent(base, { clientId: "abc12", fetchImpl: ok as unknown as typeof fetch }),
    ).toEqual({ ok: true, item: ITEM });
    expect(ok).toHaveBeenCalledWith(
      "/api/calendar/events",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ...eventPayload(base), clientId: "abc12" }),
      }),
    );
    const auth = vi.fn(async () => json(502, { error: "auth" }));
    expect(await postEvent(base, { fetchImpl: auth as unknown as typeof fetch })).toEqual({
      ok: false,
      message: addEventError("auth"),
    });
    const down = vi.fn(async () => {
      throw new TypeError("down");
    });
    expect((await postEvent(base, { fetchImpl: down as unknown as typeof fetch })).ok).toBe(false);
  });

  it("mergeAdded skips ids already in the list", () => {
    const other = { ...ITEM, id: "project:1", source: "project" as const };
    expect(mergeAdded([other], [ITEM])).toEqual([other, ITEM]);
    const list = [other, ITEM];
    expect(mergeAdded(list, [ITEM])).toBe(list);
    expect(mergeAdded(list, [])).toBe(list);
  });
});

describe("AddEventButton", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  beforeEach(() => {
    // jsdom may lack the modal API.
    const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
    proto.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    proto.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  });
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = undefined;
    vi.unstubAllGlobals();
  });

  async function mount(props: Parameters<typeof AddEventButton>[0]) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root!.render(createElement(AddEventButton, props)));
    return host;
  }
  const button = () => document.querySelector<HTMLButtonElement>("[data-testid=add-event]")!;
  const type = (el: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  it("is disabled with '설정 필요' when write is off", async () => {
    await mount({ defaultDate: "2026-11-05" });
    expect(button().disabled).toBe(true);
    expect(document.body.textContent).toContain("설정 필요");
  });

  it("posts the form and hands the item to onAdded", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      json(201, { item: ITEM }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onAdded = vi.fn();
    await mount({ enabled: true, defaultDate: "2026-11-05", onAdded });
    expect(document.body.textContent).not.toContain("설정 필요");
    await act(async () => button().click());

    const date = document.querySelector<HTMLInputElement>("input[type=date]")!;
    expect(date.value).toBe("2026-11-05");
    const [title] = document.querySelectorAll<HTMLInputElement>("dialog input");
    const [start] = document.querySelectorAll<HTMLInputElement>("input[type=time]");
    await act(async () => {
      type(title, "회의");
      type(start, "14:00");
    });
    await act(async () => {
      document.querySelector("form")!.requestSubmit();
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      title: "회의",
      date: "2026-11-05",
      start: "14:00",
      clientId: expect.stringMatching(/^[0-9a-f]{32}$/),
    });
    expect(onAdded).toHaveBeenCalledWith(ITEM);
    expect(document.querySelector("[role=status]")?.textContent).toBe(ADDED);
  });

  it("shows the mapped notice on failure and keeps the form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(503, { error: "not_configured" })),
    );
    const onAdded = vi.fn();
    await mount({ enabled: true, defaultDate: "2026-11-05", onAdded });
    await act(async () => button().click());
    const [title] = document.querySelectorAll<HTMLInputElement>("dialog input");
    await act(async () => type(title, "회의"));
    await act(async () => {
      document.querySelector("form")!.requestSubmit();
    });
    expect(onAdded).not.toHaveBeenCalled();
    expect(document.querySelector("[role=status]")?.textContent).toBe(
      addEventError("not_configured"),
    );
    expect(document.querySelector("form")).not.toBeNull();
  });

  it("blocks an end at or before the start before sending", async () => {
    const fetchMock = vi.fn(async () => json(201, { item: ITEM }));
    vi.stubGlobal("fetch", fetchMock);
    await mount({ enabled: true, defaultDate: "2026-11-05" });
    await act(async () => button().click());
    const [title] = document.querySelectorAll<HTMLInputElement>("dialog input");
    const [start, end] = document.querySelectorAll<HTMLInputElement>("input[type=time]");
    await act(async () => {
      type(title, "회의");
      type(start, "23:00");
    });
    await act(async () => type(end, "01:00"));
    expect(document.querySelector("[role=alert]")?.textContent).toMatch(/자정/);
    const submitButton = document.querySelector<HTMLButtonElement>("button[type=submit]")!;
    expect(submitButton.disabled).toBe(true);
    await act(async () => {
      document.querySelector("form")!.requestSubmit();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a retry of the same form sends the same clientId; an edit gets a new one", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      json(502, { error: "network" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await mount({ enabled: true, defaultDate: "2026-11-05" });
    await act(async () => button().click());
    const [title] = document.querySelectorAll<HTMLInputElement>("dialog input");
    const submit = () =>
      act(async () => {
        document.querySelector("form")!.requestSubmit();
      });
    await act(async () => type(title, "회의"));
    await submit();
    await submit();
    await act(async () => type(title, "회의 2"));
    await submit();
    const ids = fetchMock.mock.calls.map((c) => JSON.parse(String(c[1]?.body)).clientId);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
  });
});
