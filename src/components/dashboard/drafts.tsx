"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";

/**
 * What a home input holds across a remount: the calendar's Suspense fallback carries its own
 * copies of the inputs, swapped for new ones once the calendar loads (`/` may already have
 * focused one and the user typed). The new input picks up the text, focus and caret.
 */
export type Draft = {
  value: string;
  focused: boolean;
  start: number | null;
  end: number | null;
};

const DraftContext = createContext<Map<string, Draft> | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const drafts = useRef(new Map<string, Draft>());
  return <DraftContext.Provider value={drafts.current}>{children}</DraftContext.Provider>;
}

/** The draft for `key`, or undefined outside a `DraftProvider`. Stable across renders. */
export function useDraft(key: string): Draft | undefined {
  const drafts = useContext(DraftContext);
  if (!drafts) return undefined;
  let draft = drafts.get(key);
  if (!draft) {
    draft = { value: "", focused: false, start: null, end: null };
    drafts.set(key, draft);
  }
  return draft;
}
