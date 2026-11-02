"use client";

import { useEffect, useState } from "react";
import { Kbd, cn } from "@/components/ui";
import { OPEN_PALETTE_EVENT } from "./palette";

const isApplePlatform = () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

/** Sidebar entry that opens the command palette; shows the platform's shortcut. */
export function SearchButton({ className }: { className?: string }) {
  // "Ctrl" on the server and first render; switch after mount to avoid a hydration mismatch.
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => {
    if (isApplePlatform()) setMod("⌘");
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 rounded-lg border border-border bg-bg px-2.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-fg",
        className,
      )}
    >
      <span aria-hidden>⌕</span>
      <span className="flex-1 text-left">검색</span>
      <span className="flex items-center gap-0.5" aria-label={`단축키 ${mod} K`}>
        <Kbd>{mod}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}
