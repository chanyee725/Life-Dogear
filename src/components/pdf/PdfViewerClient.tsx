"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import {
  computeLayout,
  positionAt,
  samePosition,
  scrollTopFor,
  visibleRange,
  type Position,
} from "./layout";
import { fetchProgress, sendProgress, type ReadingProgress } from "./progress-client";
import { laterReadAt, newerRemotePosition } from "./remote-progress";

// Bundled with the app (no CDN). Must be set in the module that renders react-pdf.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// cMaps and standard fonts (needed for CJK PDFs without embedded fonts) and wasm
// image decoders, served
// from node_modules by /api/pdfjs. Module-level so the options object is stable.
const PDFJS_ASSETS = `/api/pdfjs/${pdfjs.version}`;
const DOCUMENT_OPTIONS = {
  cMapUrl: `${PDFJS_ASSETS}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${PDFJS_ASSETS}/standard_fonts/`,
  // Decoders for JPEG 2000 / JBIG2 images common in scanned papers.
  wasmUrl: `${PDFJS_ASSETS}/wasm/`,
  iccUrl: `${PDFJS_ASSETS}/iccs/`,
};

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const MAX_BASE_WIDTH = 960;
const MIN_BASE_WIDTH = 240;
const PADDING = 24;
const GAP = 16;

export type PdfViewerProps = {
  /** PDF URL, e.g. `/api/papers/<id>/pdf`. Remount (change `key`) when the file is replaced. */
  file: string;
  /** Position to restore (1-based page, 0–1 within the page). */
  initialPage?: number | null;
  initialScroll?: number | null;
  /**
   * `lastReadAt` that `initialPage`/`initialScroll` came from. With `progressUrl`,
   * the viewer re-checks the server on mount and when restored from history and
   * jumps to a position saved later than this (stale props from a cache).
   */
  initialReadAt?: string | null;
  /** When set, positions are saved here (debounced PUT, beacon on page hide). */
  progressUrl?: string;
  /** Called with each saved position (same debounce as saving). */
  onProgress?: (progress: ReadingProgress) => void;
  /** Debounce for saving, in ms. */
  saveDelay?: number;
  /** Shown at the left of the toolbar (e.g. back link and title). */
  header?: ReactNode;
  className?: string;
};

export default function PdfViewerClient({
  file,
  initialPage,
  initialScroll,
  initialReadAt = null,
  progressUrl,
  onProgress,
  saveDelay = 800,
  header,
  className = "",
}: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  /** Height/width ratio per page index; index 0 doubles as the estimate for unloaded pages. */
  const [aspects, setAspects] = useState<Record<number, number>>({});
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [range, setRange] = useState<[number, number]>([0, -1]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageDraft, setPageDraft] = useState<string | null>(null);

  const initial: Position = { page: initialPage ?? 1, scroll: initialScroll ?? 0 };
  /** Position kept stable across zoom, resize and page-size corrections. */
  const anchorRef = useRef<Position>(initial);
  const lastQueuedRef = useRef<Position | null>(initial);
  /** Latest read time this page knows of (server value or our own last save). */
  const knownReadAtRef = useRef<string | null>(initialReadAt);
  const markSaved = () => {
    knownReadAtRef.current = laterReadAt(new Date().toISOString(), knownReadAtRef.current);
  };
  const pendingRef = useRef<ReadingProgress | null>(null);
  const readyRef = useRef(false);
  const frameRef = useRef(0);

  const baseWidth = Math.max(
    MIN_BASE_WIDTH,
    Math.min(viewport.width - PADDING * 2, MAX_BASE_WIDTH),
  );
  const pageWidth = Math.round(baseWidth * zoom);
  const ready = numPages > 0 && aspects[0] !== undefined && viewport.width > 0;

  const layout = useMemo(() => {
    const fallback = aspects[0] ?? 1.414;
    const heights = Array.from({ length: numPages }, (_, i) =>
      Math.round(pageWidth * (aspects[i] ?? fallback)),
    );
    return computeLayout(heights, GAP, PADDING);
  }, [aspects, numPages, pageWidth]);
  const layoutRef = useRef(layout);

  const onProgressRef = useRef(onProgress);
  useEffect(() => {
    onProgressRef.current = onProgress;
  });

  const save = useDebouncedCallback(
    (progress: ReadingProgress) => {
      pendingRef.current = null;
      onProgressRef.current?.(progress);
      if (progressUrl) {
        markSaved();
        sendProgress(progressUrl, progress);
      }
    },
    saveDelay,
    { flushOnUnmount: true },
  );

  // Save the last position when the tab is hidden or closed.
  useEffect(() => {
    const flushWithBeacon = () => {
      const progress = pendingRef.current;
      if (!progress) return;
      save.cancel();
      pendingRef.current = null;
      onProgressRef.current?.(progress);
      if (progressUrl) {
        markSaved();
        sendProgress(progressUrl, progress, { beacon: true });
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushWithBeacon();
    };
    window.addEventListener("pagehide", flushWithBeacon);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushWithBeacon);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [save, progressUrl]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setViewport((prev) =>
        prev.width === el.clientWidth && prev.height === el.clientHeight
          ? prev
          : { width: el.clientWidth, height: el.clientHeight },
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  // Catch up with a position saved after these props were rendered: the page may
  // come from the router/bfcache on back navigation, or another tab kept reading.
  useEffect(() => {
    if (!progressUrl) return;
    let cancelled = false;
    const check = async () => {
      const remote = await fetchProgress(progressUrl);
      if (!remote || cancelled) return;
      const next = newerRemotePosition(
        remote,
        knownReadAtRef.current,
        readyRef.current ? anchorRef.current : null,
        pendingRef.current !== null,
      );
      knownReadAtRef.current = laterReadAt(remote.lastReadAt, knownReadAtRef.current);
      if (!next) return;
      anchorRef.current = next;
      lastQueuedRef.current = next;
      const el = scrollRef.current;
      // Before the first layout the anchor is applied by the layout effect.
      if (el && readyRef.current) el.scrollTop = scrollTopFor(layoutRef.current, next);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check();
    };
    const onPopState = () => void check();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    void check();
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [progressUrl]);

  const syncView = useCallback((el: HTMLDivElement) => {
    const current = layoutRef.current;
    const next = visibleRange(current, el.scrollTop, el.clientHeight, el.clientHeight);
    setRange((prev) => (prev[0] === next[0] && prev[1] === next[1] ? prev : next));
    const position = positionAt(current, el.scrollTop, el.clientHeight);
    if (position) setCurrentPage(position.page);
    return position;
  }, []);

  // Restore / keep the anchored position whenever geometry changes. Runs before
  // paint so the first visible frame is already at the saved position.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !ready) return;
    layoutRef.current = layout;
    el.scrollTop = scrollTopFor(layout, anchorRef.current);
    // The resulting scroll event must not count as reading progress.
    lastQueuedRef.current = syncView(el);
    readyRef.current = true;
  }, [layout, ready, viewport.height, syncView]);

  const handleScroll = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      const el = scrollRef.current;
      if (!el || !readyRef.current) return;
      const position = syncView(el);
      if (!position) return;
      anchorRef.current = position;
      if (samePosition(position, lastQueuedRef.current)) return;
      lastQueuedRef.current = position;
      const progress = { ...position, totalPages: layoutRef.current.tops.length };
      pendingRef.current = progress;
      save(progress);
    });
  }, [save, syncView]);

  const goToPage = (page: number) => {
    const el = scrollRef.current;
    if (!el || !numPages) return;
    anchorRef.current = { page: Math.min(numPages, Math.max(1, page)), scroll: 0 };
    el.scrollTop = scrollTopFor(layoutRef.current, anchorRef.current);
  };

  const onDocumentLoad = (pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages);
    pdf
      .getPage(1)
      .then((page) => {
        const { width, height } = page.getViewport({ scale: 1 });
        setAspects({ 0: height / width });
      })
      .catch(() => setAspects({ 0: 1.414 }));
  };

  const onPageLoad = (index: number, width: number, height: number) => {
    const aspect = height / width;
    setAspects((prev) => {
      const known = prev[index] ?? prev[0];
      if (known !== undefined && Math.abs(known - aspect) / known < 0.005) return prev;
      return { ...prev, [index]: aspect };
    });
  };

  const zoomIndex = ZOOM_STEPS.indexOf(zoom);
  const pages: number[] = [];
  if (ready) for (let i = range[0]; i <= range[1]; i++) pages.push(i);

  const toolbarButton =
    "rounded-md px-2 py-1 text-muted hover:bg-hover hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div className="flex h-11 shrink-0 items-center gap-4 border-b border-border bg-bg px-3 text-sm">
        {header ? <div className="flex min-w-0 flex-1 items-center gap-2">{header}</div> : null}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={toolbarButton}
            onClick={() => goToPage(currentPage - 1)}
            disabled={!ready || currentPage <= 1}
            aria-label="이전 쪽"
          >
            ‹
          </button>
          <input
            className="w-12 rounded-md border border-border bg-transparent px-1.5 py-0.5 text-center tabular-nums focus:border-accent focus:outline-none"
            inputMode="numeric"
            aria-label="쪽 번호"
            disabled={!ready}
            value={pageDraft ?? String(currentPage)}
            onFocus={(e) => {
              setPageDraft(String(currentPage));
              e.currentTarget.select();
            }}
            onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, ""))}
            onBlur={() => setPageDraft(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const page = Number(pageDraft);
                if (page) goToPage(page);
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                e.currentTarget.blur();
              }
            }}
          />
          <span className="text-muted tabular-nums">/ {numPages || "–"}</span>
          <button
            type="button"
            className={toolbarButton}
            onClick={() => goToPage(currentPage + 1)}
            disabled={!ready || currentPage >= numPages}
            aria-label="다음 쪽"
          >
            ›
          </button>
        </div>
        <div className={`flex items-center gap-1 ${header ? "" : "ml-auto"}`}>
          <button
            type="button"
            className={toolbarButton}
            onClick={() => setZoom(ZOOM_STEPS[zoomIndex - 1])}
            disabled={zoomIndex <= 0}
            aria-label="축소"
          >
            −
          </button>
          <button
            type="button"
            className={`${toolbarButton} w-14 tabular-nums`}
            onClick={() => setZoom(1)}
            title="폭에 맞추기"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className={toolbarButton}
            onClick={() => setZoom(ZOOM_STEPS[zoomIndex + 1])}
            disabled={zoomIndex >= ZOOM_STEPS.length - 1}
            aria-label="확대"
          >
            +
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        tabIndex={0}
        aria-label="PDF 본문"
        className="relative min-h-0 flex-1 overflow-auto bg-subtle outline-none"
      >
        <Document
          file={file}
          options={DOCUMENT_OPTIONS}
          suspense={false}
          onLoadSuccess={onDocumentLoad}
          loading={<Status>PDF를 불러오는 중…</Status>}
          error={<Status>PDF를 불러오지 못했습니다.</Status>}
          noData={<Status>PDF 파일이 없습니다.</Status>}
        >
          {ready && (
            <div
              className="relative mx-auto"
              style={{ height: layout.height, width: pageWidth + PADDING * 2 }}
            >
              {pages.map((i) => (
                <div
                  key={i}
                  className="absolute overflow-hidden rounded-sm bg-white ring-1 ring-border"
                  style={{
                    top: layout.tops[i],
                    left: PADDING,
                    width: pageWidth,
                    height: layout.heights[i],
                  }}
                >
                  <Page
                    pageNumber={i + 1}
                    width={pageWidth}
                    suspense={false}
                    loading={() => null}
                    onLoadSuccess={(page) => {
                      const { width, height } = page.getViewport({ scale: 1 });
                      onPageLoad(i, width, height);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </Document>
      </div>
    </div>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted">
      {children}
    </div>
  );
}
