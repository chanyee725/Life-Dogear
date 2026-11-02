"use client";

import { readerHref, scrollTargetFor } from "@/lib/highlights";
import type { Highlight } from "@/lib/repo/highlights";
import { HighlightPanel } from "./HighlightPanel";
import { useHighlightList } from "./useHighlightList";

/**
 * "하이라이트" section for the paper detail page. With a PDF, each item links to
 * the reader at that page (`?page=&scroll=`).
 */
export function PaperHighlights({
  paperId,
  initialHighlights,
  hasPdf,
}: {
  paperId: string;
  initialHighlights: Highlight[];
  hasPdf: boolean;
}) {
  const { highlights, replace, removeById } = useHighlightList(initialHighlights);
  return (
    <section aria-labelledby="paper-highlights-title" className="flex flex-col gap-3">
      <h2 id="paper-highlights-title" className="text-[13px] font-semibold text-muted">
        하이라이트 <span className="tabular-nums text-faint">{highlights.length}</span>
      </h2>
      <HighlightPanel
        highlights={highlights}
        hrefFor={hasPdf ? (h) => readerHref(paperId, h.page, scrollTargetFor(h.rects)) : undefined}
        onUpdated={replace}
        onRemoved={removeById}
      />
    </section>
  );
}
