"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** One segmented control: buttons share a frame, split by hairlines. */
export const SEG_GROUP = "rb-roadmap-seg";
export const SEG_BTN = "rb-roadmap-seg-btn";

/** The `?all=1` URL for the opposite of `includeDone`, keeping any other params. */
export function includeDoneHref(
  pathname: string,
  params: URLSearchParams | null,
  includeDone: boolean,
): string {
  const next = new URLSearchParams(params?.toString());
  if (includeDone) next.delete("all");
  else next.set("all", "1");
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export interface RoadmapToolbarProps {
  /** Current `?all=1` state, as read by page.tsx. */
  includeDone: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  /** Disable 모두 펼치기 when nothing is collapsed (see `isAllExpanded`). */
  allExpanded?: boolean;
  /** Disable 모두 접기 when everything is already collapsed (see `isAllCollapsed`). */
  allCollapsed?: boolean;
  className?: string;
  /** Right-hand controls (zoom), drawn as their own segment group. */
  children?: ReactNode;
}

/**
 * 모두 펼치기 / 모두 접기 / 완료 포함. The first two call back into the tree's collapse
 * state; 완료 포함 swaps `?all=1` in the URL (replace, no scroll) so the server page
 * reloads with done items.
 */
export default function RoadmapToolbar({
  includeDone,
  onExpandAll,
  onCollapseAll,
  allExpanded = false,
  allCollapsed = false,
  className,
  children,
}: RoadmapToolbarProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div
      role="toolbar"
      aria-label="로드맵 보기"
      data-testid="roadmap-toolbar"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <div className={SEG_GROUP}>
        <button
          type="button"
          data-testid="roadmap-expand-all"
          onClick={onExpandAll}
          disabled={allExpanded}
          className={SEG_BTN}
        >
          모두 펼치기
        </button>
        <button
          type="button"
          data-testid="roadmap-collapse-all"
          onClick={onCollapseAll}
          disabled={allCollapsed}
          className={SEG_BTN}
        >
          모두 접기
        </button>
      </div>
      <div className={SEG_GROUP}>
        <Link
          href={includeDoneHref(pathname, params, includeDone)}
          replace
          scroll={false}
          role="switch"
          aria-checked={includeDone}
          data-testid="roadmap-include-done"
          className={SEG_BTN}
        >
          <span aria-hidden="true" className="rb-roadmap-switch" />
          완료 포함
        </Link>
      </div>
      {children}
    </div>
  );
}
