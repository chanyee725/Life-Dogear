"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";
import { buildLinerSearchUrl, LINER_URL_INCLUDES_TITLE } from "@/lib/liner";

const COPIED = "제목을 복사했어요. 라이너 검색창에 붙여넣으세요.";
const COPY_FAILED = "제목을 복사하지 못했어요. 라이너 검색창에 제목을 직접 입력하세요.";

/**
 * "라이너에서 열기": opens Liner Scholar in a new tab and copies the paper title to
 * the clipboard (Liner has no documented title-search URL; see `buildLinerSearchUrl`).
 * A real link, so middle-click / open-in-new-tab work too.
 */
export function OpenInLiner({ title }: { title: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const trimmed = title.trim();

  async function copyTitle() {
    if (LINER_URL_INCLUDES_TITLE || !trimmed) return;
    try {
      await navigator.clipboard.writeText(trimmed);
      setMessage(COPIED);
    } catch {
      setMessage(COPY_FAILED);
    }
  }

  return (
    // The notice floats under the button so it never shifts the row it sits in.
    <span className="relative inline-flex">
      <a
        href={buildLinerSearchUrl(trimmed)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass("secondary", "sm")}
        // Short text below `lg` keeps the paper header on one line; the name stays full.
        aria-label="라이너에서 열기 (새 탭)"
        title="라이너에서 열기"
        // Copy synchronously within the click so the clipboard permission applies.
        onClick={() => void copyTitle()}
      >
        <span className="hidden lg:inline">라이너에서 열기</span>
        <span className="lg:hidden">라이너</span> ↗
      </a>
      <span
        aria-live="polite"
        className="absolute top-full right-0 z-10 mt-1 text-xs whitespace-nowrap text-faint"
      >
        {message}
      </span>
    </span>
  );
}
