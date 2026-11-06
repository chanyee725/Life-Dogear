"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/components/ui/cn";

const BTN =
  "inline-flex h-7 shrink-0 cursor-pointer items-center rounded-md border border-border px-2 text-[13px] text-muted transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted";

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
}: RoadmapToolbarProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div
      role="toolbar"
      aria-label="로드맵 보기"
      data-testid="roadmap-toolbar"
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      <button
        type="button"
        data-testid="roadmap-expand-all"
        onClick={onExpandAll}
        disabled={allExpanded}
        className={BTN}
      >
        모두 펼치기
      </button>
      <button
        type="button"
        data-testid="roadmap-collapse-all"
        onClick={onCollapseAll}
        disabled={allCollapsed}
        className={BTN}
      >
        모두 접기
      </button>
      <Link
        href={includeDoneHref(pathname, params, includeDone)}
        replace
        scroll={false}
        role="switch"
        aria-checked={includeDone}
        data-testid="roadmap-include-done"
        className={cn(
          BTN,
          "gap-1.5",
          includeDone && "border-border-strong bg-subtle text-fg hover:bg-subtle",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-2 rounded-full border",
            includeDone ? "border-fg bg-fg" : "border-border-strong",
          )}
        />
        완료 포함
      </Link>
    </div>
  );
}
