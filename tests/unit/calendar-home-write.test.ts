// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  HomeCalendarView,
  HomeDayProvider,
  type HomeCalendarData,
} from "@/components/dashboard/HomeCalendarDay";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/_actions/tasks", () => ({ createTask: vi.fn(), updateTask: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

let root: Root | undefined;
let host: HTMLDivElement | undefined;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
});

async function mountHome(data: HomeCalendarData) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      createElement(HomeDayProvider, {
        today: "2026-11-05",
        children: createElement(HomeCalendarView, {
          data: Promise.resolve(data),
          range: "month",
          date: "2026-11-05",
          today: "2026-11-05",
          now: "2026-11-05T01:00:00.000Z",
          syncUrl: false,
        }),
      }),
    );
  });
  return host.querySelector<HTMLButtonElement>("[data-testid=add-event]")!;
}

describe("home calendar: 일정 추가", () => {
  it("is enabled when the loaded data says Google write is on", async () => {
    const button = await mountHome({ items: [], google: "off", googleWrite: true, failed: false });
    expect(button.textContent).toBe("일정 추가");
    expect(button.disabled).toBe(false);
  });

  it("stays disabled with '설정 필요' when it is off", async () => {
    const button = await mountHome({ items: [], google: "off", googleWrite: false, failed: false });
    expect(button.disabled).toBe(true);
    expect(host!.textContent).toContain("설정 필요");
  });
});
