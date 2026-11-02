/**
 * Where "라이너에서 열기" goes.
 *
 * Liner documents no title-search URL format (docs/p2/liner-research.md, checked
 * 2026-11-02), so we open the confirmed Scholar page and the UI copies the title to
 * the clipboard for the user to paste. The title is never put into the URL.
 * When an official search-URL format is confirmed, change only this function.
 */
export const LINER_SCHOLAR_URL = "https://liner.com/scholar";

export function buildLinerSearchUrl(title: string): string {
  void title; // Unused until an official query format is confirmed.
  return LINER_SCHOLAR_URL;
}

/** Whether `buildLinerSearchUrl` already carries the title (then no clipboard copy is needed). */
export const LINER_URL_INCLUDES_TITLE = false;
