"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createHighlight } from "@/app/_actions/highlights";
import { safeAction } from "@/components/links/safe-action";
import { PdfViewer, type PdfViewerProps } from "@/components/pdf/PdfViewer";
import { Button, cn } from "@/components/ui";
import { scrollTargetFor, type HighlightColor } from "@/lib/highlights";
import type { Highlight } from "@/lib/repo/highlights";
import { HighlightPanel } from "./HighlightPanel";
import { PageHighlights } from "./PageHighlights";
import { readSelection, type PendingHighlight } from "./selection";
import { SelectionMenu } from "./SelectionMenu";
import type { PdfViewerApi } from "./viewer-hooks";
import { useHighlightList } from "./useHighlightList";

export type HighlightReaderProps = Omit<PdfViewerProps, "renderPageOverlay" | "apiRef"> & {
  paperId: string;
  initialHighlights: Highlight[];
};

const ACTIVE_MS = 2_000;

/**
 * PDF reader with highlights: select text → floating menu (colour, note) → saved
 * and drawn over the page; a side panel lists them (click to jump, edit, delete,
 * "생각 만들기"). Wraps the 1팀 viewer through its overlay/api hooks only.
 */
export function HighlightReader({
  paperId,
  initialHighlights,
  toolbarEnd,
  ...viewerProps
}: HighlightReaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<PdfViewerApi | null>(null);
  const { highlights, add, replace, removeById } = useHighlightList(initialHighlights);
  const [pending, setPending] = useState<PendingHighlight | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const byPage = useMemo(() => {
    const map = new Map<number, Highlight[]>();
    for (const h of highlights) map.set(h.page, [...(map.get(h.page) ?? []), h]);
    return map;
  }, [highlights]);

  const renderPageOverlay = useCallback(
    (page: number) => <PageHighlights items={byPage.get(page) ?? []} activeId={activeId} />,
    [byPage, activeId],
  );

  useEffect(() => {
    if (!activeId) return;
    const timer = setTimeout(() => setActiveId(null), ACTIVE_MS);
    return () => clearTimeout(timer);
  }, [activeId]);

  const closeMenu = useCallback(() => {
    setPending(null);
    setError(null);
  }, []);

  // Read the selection after the browser has finished updating it.
  const checkSelection = () => {
    requestAnimationFrame(() => {
      const root = rootRef.current;
      if (!root || saving) return;
      const next = readSelection(root);
      setError(null);
      setPending(next);
    });
  };

  async function save(color: HighlightColor, note: string) {
    if (!pending) return;
    setSaving(true);
    setError(null);
    const result = await safeAction(() =>
      createHighlight({
        paperId,
        page: pending.page,
        text: pending.text,
        rects: pending.rects,
        color,
        note,
      }),
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    add(result.data);
    window.getSelection()?.removeAllRanges();
    setPending(null);
  }

  function jump(h: Highlight) {
    apiRef.current?.goToPage(h.page, scrollTargetFor(h.rects));
    setActiveId(h.id);
  }

  return (
    <div className="flex h-full min-h-0">
      <div
        ref={rootRef}
        className="min-w-0 flex-1"
        onMouseUp={checkSelection}
        onKeyUp={(e) => {
          if (e.shiftKey) checkSelection();
        }}
        // The menu is placed in window coordinates; close it once the page moves.
        onScrollCapture={() => {
          if (pending && !saving) closeMenu();
        }}
      >
        <PdfViewer
          {...viewerProps}
          apiRef={apiRef}
          renderPageOverlay={renderPageOverlay}
          toolbarEnd={
            <>
              <Button
                size="sm"
                variant={panelOpen ? "secondary" : "ghost"}
                aria-expanded={panelOpen}
                aria-controls="highlight-panel"
                onClick={() => setPanelOpen((v) => !v)}
              >
                하이라이트 {highlights.length}
              </Button>
              {toolbarEnd}
            </>
          }
        />
      </div>

      <aside
        id="highlight-panel"
        aria-label="하이라이트 목록"
        hidden={!panelOpen}
        className={cn(
          "w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-bg",
          panelOpen ? "flex" : "hidden",
        )}
      >
        <h2 className="sticky top-0 z-10 flex h-11 shrink-0 items-center border-b border-border bg-bg px-4 text-sm font-medium">
          하이라이트
        </h2>
        <HighlightPanel
          className="p-2"
          highlights={highlights}
          activeId={activeId}
          onJump={jump}
          onUpdated={replace}
          onRemoved={removeById}
        />
      </aside>

      {pending ? (
        <SelectionMenu
          key={`${pending.page}:${pending.text}`}
          pending={pending}
          saving={saving}
          error={error}
          onSave={(color, note) => void save(color, note)}
          onClose={closeMenu}
        />
      ) : null}
    </div>
  );
}
