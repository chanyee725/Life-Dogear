"use client";

import { cn } from "@/components/ui/cn";
import { useSidebarCollapsed } from "./sidebar-state";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Focus mode (S8): hides the sidebar and remembers it. Place it in the reading view's
 * toolbar; the sidebar itself shows a small "사이드바 열기" button while collapsed,
 * so other pages can always bring it back.
 */
export function FocusModeToggle({ className }: { className?: string }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  return (
    <Tooltip content={collapsed ? "집중 모드 끄기" : "집중 모드 (사이드바 숨기기)"}>
      <button
        type="button"
        aria-pressed={collapsed}
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] transition-colors",
          collapsed ? "bg-hover text-fg" : "text-muted hover:bg-hover hover:text-fg",
          className,
        )}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden="true"
        >
          <rect x="1.75" y="2.5" width="12.5" height="11" rx="1.5" />
          <path d="M5.5 2.5v11" />
        </svg>
        집중 모드
      </button>
    </Tooltip>
  );
}
