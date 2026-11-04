"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SOURCES, SOURCES_KEY, parseSources, type SourceChoice } from "./sources";

const EVENT = "rb-calendar-sources";

/** "표시" choice from localStorage (defaults until mounted); shared by every calendar view. */
export function useSources(): [SourceChoice, (next: SourceChoice) => void] {
  const [choice, setChoice] = useState<SourceChoice>(DEFAULT_SOURCES);
  useEffect(() => {
    const read = () => {
      try {
        setChoice(parseSources(localStorage.getItem(SOURCES_KEY)));
      } catch {
        // Storage unavailable: keep the defaults.
      }
    };
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  const update = useCallback((next: SourceChoice) => {
    setChoice(next);
    try {
      localStorage.setItem(SOURCES_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // Ignore: the choice just isn't remembered.
    }
  }, []);
  return [choice, update];
}
