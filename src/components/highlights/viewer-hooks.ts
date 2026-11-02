/**
 * The highlight feature uses only these parts of the 1팀 PDF viewer:
 * `renderPageOverlay`, `apiRef` (`PdfViewerApi.goToPage`) and the
 * `data-pdf-page="<n>"` attribute on each page box.
 */
export type { PdfViewerApi } from "@/components/pdf/PdfViewer";

/** Attribute the viewer puts on each page box; the selection code finds pages by it. */
export const PAGE_ATTR = "data-pdf-page";
