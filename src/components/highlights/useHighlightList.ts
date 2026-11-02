"use client";

import { useCallback, useState } from "react";
import type { Highlight } from "@/lib/repo/highlights";
import { sortHighlights } from "@/lib/highlights";

/** Local highlight list kept in reading order after adds and edits. */
export function useHighlightList(initial: Highlight[]) {
  const [highlights, setHighlights] = useState(() => sortHighlights(initial));
  const add = useCallback(
    (h: Highlight) => setHighlights((prev) => sortHighlights([...prev, h])),
    [],
  );
  const replace = useCallback(
    (h: Highlight) => setHighlights((prev) => prev.map((x) => (x.id === h.id ? h : x))),
    [],
  );
  const removeById = useCallback(
    (id: string) => setHighlights((prev) => prev.filter((x) => x.id !== id)),
    [],
  );
  return { highlights, add, replace, removeById };
}
