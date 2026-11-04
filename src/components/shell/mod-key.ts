"use client";

import { useSyncExternalStore } from "react";

export type ModKey = "⌘" | "Ctrl";

/** Apple platforms (macOS, iOS, iPadOS) use ⌘; Linux and Windows use Ctrl. */
export function isApplePlatform(platform: string): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

export function modKeyFor(platform: string): ModKey {
  return isApplePlatform(platform) ? "⌘" : "Ctrl";
}

const subscribe = () => () => {};
const clientSnapshot = (): ModKey => modKeyFor(navigator.platform || navigator.userAgent);
// The server can't know the platform: render "Ctrl", then hydration switches to the client value
// without a mismatch (same approach as the sidebar search button).
const serverSnapshot = (): ModKey => "Ctrl";

/** The label of the platform's command modifier, for shortcut hints ("⌘" or "Ctrl"). */
export function useModKey(): ModKey {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
