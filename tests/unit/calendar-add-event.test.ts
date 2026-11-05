// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddEventButton } from "@/components/calendar/AddEventButton";
import { AppToaster } from "@/components/ui/Toast";
import {
  ADDED,
  addEventError,
  checkEvent,
  eventPayload,
  mergeAdded,
  postEvent,
  revealAdded,
} from "@/components/calendar/add-event";
import { DEFAULT_SOURCES, visibleItems } from "@/components/calendar/sources";
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
      code: "auth",
    });
    const down = vi.fn(async () => {
      throw new TypeError("down");
    });
    expect((await postEvent(base, { fetchImpl: down as unknown as typeof fetch })).ok).toBe(false);
  });

  it("mergeAdded skips ids already in the list", () => {
    const other = { ...ITEM, id: "seminar:1", source: "seminar" as const };
    expect(mergeAdded([other], [ITEM])).toEqual([other, ITEM]);
    const list = [other, ITEM];
    expect(mergeAdded(list, [ITEM])).toBe(list);
    expect(mergeAdded(list, [])).toBe(list);
  });

  // The same event coming back through the ICS feed (e2e leaves this to unit tests).
  it("mergeAdded keeps one copy when the ICS feed returns the item in UTC", () => {
    const fromIcs: CalendarItem = {
      ...ITEM,
      id: "google:abc@google.com:2026-11-05T05:00:00Z",
      start: "2026-11-05T05:00:00Z",
      end: "2026-11-05T06:00:00Z",
    };
    // Feed caught up after the add: the fetched copy stays, the added one is dropped.
    const list = [fromIcs];
    expect(mergeAdded(list, [ITEM])).toBe(list);
    // Added first, then the feed's list arrives and the added item is merged again.
    expect(mergeAdded([fromIcs], mergeAdded([], [ITEM]))).toEqual([fromIcs]);
  });

  it("mergeAdded reads a uid with colons and falls back to the id on a bad start", () => {
    const uid = "x:y@google.com";
    const a: CalendarItem = { ...ITEM, id: `google:${uid}:${ITEM.start}` };
    const b: CalendarItem = {
      ...a,
      id: `google:${uid}:2026-11-05T05:00:00Z`,
      start: "2026-11-05T05:00:00Z",
    };
    expect(mergeAdded([b], [a])).toEqual([b]);
    const bad: CalendarItem = { ...ITEM, id: "google:u:not-a-time", start: "not-a-time" };
    expect(mergeAdded([bad], [{ ...bad }])).toEqual([bad]);
    expect(mergeAdded([bad], [ITEM])).toEqual([bad, ITEM]);
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
    // Toasts render into sonner's viewport, mounted first as in the root layout.
    await act(async () =>
      root!.render(
        createElement("div", null, createElement(AppToaster), createElement(AddEventButton, props)),
      ),
    );
    return host;
  }
  const button = () => document.querySelector<HTMLButtonElement>("[data-testid=add-event]")!;
  /** The toast's text once sonner has added it (on a 0 ms timer). */
  const toastText = async () => {
    await act(async () => void (await new Promise((r) => setTimeout(r, 0))));
    return document.querySelector("[role=status]")?.textContent;
  };
  const type = (el: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  it("is disabled with a user-facing hint and a '설정 필요' link to /settings", async () => {
    await mount({ defaultDate: "2026-11-05" });
    expect(button().disabled).toBe(true);
    expect(document.body.textContent).toContain("Google 캘린더 연결이 필요해요");
    expect(document.body.textContent).not.toContain("DEPLOY.md");
    const link = [...document.querySelectorAll("a")].find((a) => a.textContent === "설정 필요");
    expect(link?.getAttribute("href")).toBe("/settings#calendar-write");
  });

  it("posts the form and hands the item to onAdded", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      json(201, { item: ITEM }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onAdded = vi.fn();
    await mount({ enabled: true, defaultDate: "2026-11-05", onAdded });
    expect(document.body.textContent).not.toContain("연결이 필요해요");
    await act(async () => button().click());

    const date = document.querySelector<HTMLInputElement>("input[type=date]")!;
    expect(date.value).toBe("2026-11-05");
    const [title] = document.querySelectorAll<HTMLInputElement>("[role=dialog] input");
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
    expect(await toastText()).toBe(ADDED);
  });

  it("shows the mapped notice on failure and keeps the form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(503, { error: "not_configured" })),
    );
    const onAdded = vi.fn();
    await mount({ enabled: true, defaultDate: "2026-11-05", onAdded });
    await act(async () => button().click());
    const [title] = document.querySelectorAll<HTMLInputElement>("[role=dialog] input");
    await act(async () => type(title, "회의"));
    await act(async () => {
      document.querySelector("form")!.requestSubmit();
    });
    expect(onAdded).not.toHaveBeenCalled();
    expect(await toastText()).toBe(addEventError("not_configured"));
    expect(document.querySelector("form")).not.toBeNull();
  });

  it("blocks an end at or before the start before sending", async () => {
    const fetchMock = vi.fn(async () => json(201, { item: ITEM }));
    vi.stubGlobal("fetch", fetchMock);
    await mount({ enabled: true, defaultDate: "2026-11-05" });
    await act(async () => button().click());
    const [title] = document.querySelectorAll<HTMLInputElement>("[role=dialog] input");
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

  it("drops the event id after an invalid answer, so the retry uses a new one", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      json(400, { error: "invalid" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await mount({ enabled: true, defaultDate: "2026-11-05" });
    await act(async () => button().click());
    const [title] = document.querySelectorAll<HTMLInputElement>("[role=dialog] input");
    await act(async () => type(title, "회의"));
    for (let i = 0; i < 2; i++) {
      await act(async () => {
        document.querySelector("form")!.requestSubmit();
      });
    }
    const ids = fetchMock.mock.calls.map((c) => JSON.parse(String(c[1]?.body)).clientId);
    expect(ids).toHaveLength(2);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it("a retry of the same form sends the same clientId; an edit gets a new one", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      json(502, { error: "network" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await mount({ enabled: true, defaultDate: "2026-11-05" });
    await act(async () => button().click());
    const [title] = document.querySelectorAll<HTMLInputElement>("[role=dialog] input");
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

describe("revealAdded", () => {
  const item: CalendarItem = { ...ITEM, start: "2026-11-05T14:00:00+09:00" };
  const hidden = { ...DEFAULT_SOURCES, google: false };

  it("an added Google event stays visible when Google is hidden or has no feed", () => {
    for (const [choice, google] of [
      [hidden, "ok"],
      [DEFAULT_SOURCES, "off"],
      [hidden, "off"],
    ] as const) {
      expect(visibleItems([item], choice, google)).toEqual([]);
      const next = revealAdded(choice, google);
      expect(next.choice.google).toBe(true);
      expect(visibleItems(mergeAdded([], [item]), next.choice, next.google)).toEqual([item]);
    }
  });

  it("returns the same objects when nothing changes", () => {
    const shown = { ...DEFAULT_SOURCES, google: true };
    const next = revealAdded(shown, "error");
    expect(next.choice).toBe(shown);
    expect(next.google).toBe("error");
  });
});
