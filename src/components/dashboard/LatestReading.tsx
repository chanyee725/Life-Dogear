"use client";

import { ProgressBar } from "@/components/pdf/ProgressBar";
import { useLatestProgress } from "@/components/pdf/useLatestProgress";
import { formatRelative } from "./format";

/**
 * Progress bar + "n분 전 읽음" for a continue-reading card. The home page may be
 * shown from the router cache after reading, so it re-checks the server like the
 * viewer does and shows the later position.
 */
export function LatestReading({
  paperId,
  hasPdf,
  page,
  totalPages,
  lastReadAt,
}: {
  paperId: string;
  hasPdf: boolean;
  page: number | null;
  totalPages: number | null;
  lastReadAt: string | null;
}) {
  const latest = useLatestProgress(hasPdf ? `/api/papers/${paperId}/progress` : null, {
    page,
    scroll: null,
    totalPages,
    lastReadAt,
  });

  return (
    <>
      <ProgressBar current={latest.page} total={latest.totalPages} className="mt-auto pt-1" />
      {latest.lastReadAt ? (
        // Relative time depends on "now", which differs between server render and hydration.
        <span className="text-xs text-muted" suppressHydrationWarning>
          {formatRelative(latest.lastReadAt)} 읽음
        </span>
      ) : null}
    </>
  );
}
