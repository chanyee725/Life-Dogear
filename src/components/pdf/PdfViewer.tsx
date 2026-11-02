"use client";

import dynamic from "next/dynamic";
import type { PdfViewerProps } from "./PdfViewerClient";

export type { PdfViewerProps };
export type { ReadingProgress } from "./progress-client";

/**
 * Client-only PDF viewer (pdf.js touches browser APIs at import time, so it
 * never renders on the server). The parent must give it a definite height.
 */
export const PdfViewer = dynamic<PdfViewerProps>(() => import("./PdfViewerClient"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-neutral-500">
      뷰어를 불러오는 중…
    </div>
  ),
});
