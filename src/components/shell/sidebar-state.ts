"use client";

import { useSyncExternalStore } from "react";
import { SIDEBAR_ATTR, SIDEBAR_STORAGE_KEY } from "./sidebar-config";

const listeners = new Set<() => void>();

function isCollapsed(): boolean {
  return document.documentElement.getAttribute(SIDEBAR_ATTR) === "collapsed";
}

export function setSidebarCollapsed(collapsed: boolean): void {
  const root = document.documentElement;
  if (collapsed) root.setAttribute(SIDEBAR_ATTR, "collapsed");
  else root.removeAttribute(SIDEBAR_ATTR);
  try {
    if (collapsed) localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
    else localStorage.removeItem(SIDEBAR_STORAGE_KEY);
  } catch {
    // Storage unavailable: the state just isn't remembered.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Sidebar collapsed state (remembered across reloads) and its setter. */
export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, isCollapsed, () => false);
  return [collapsed, setSidebarCollapsed];
}
