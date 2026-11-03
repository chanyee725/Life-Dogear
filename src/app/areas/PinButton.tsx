"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setAreaPinned } from "@/app/_actions/areas";
import { QuietButton } from "@/components/fields/ItemDetail";
import { safeAction } from "@/components/links/safe-action";
import { cn } from "@/components/ui/cn";

/** Pushpin (not the ★ of "다시 볼 것"); filled while pinned. */
export function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M9.5 2.75 13.25 6.5l-1.5.5-2 2v2l-4.5-4.5h2l2-2Z"
        fill={filled ? "currentColor" : "none"}
      />
      <path d="M7.5 8.5 3 13" />
    </svg>
  );
}

/** Pin state with an optimistic flip and the server action; the layout refresh syncs the rest. */
function usePin(areaId: string, pinned: boolean) {
  const [shown, setShown] = useOptimistic(pinned);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toggle = () => {
    const next = !shown;
    setError(null);
    startTransition(async () => {
      setShown(next);
      const result = await safeAction(() => setAreaPinned(areaId, next));
      if (!result.ok) setError(result.error);
    });
  };
  return { shown, pending, error, toggle };
}

/**
 * Small icon toggle for a row of the areas list. Unpinned rows show it on hover or focus
 * (always on touch screens); pinned ones always do.
 */
export function PinIconButton({
  areaId,
  title,
  pinned,
}: {
  areaId: string;
  title: string;
  pinned: boolean;
}) {
  const { shown, pending, error, toggle } = usePin(areaId, pinned);
  const label = shown ? "고정 해제" : "사이드바에 고정";
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={shown}
        aria-label={`${title} ${label}`}
        title={label}
        className={cn(
          "-my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-hover hover:text-fg motion-reduce:transition-none",
          shown
            ? "text-muted"
            : "text-faint group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:opacity-0",
        )}
      >
        <PinIcon filled={shown} />
      </button>
      {error ? (
        <span role="alert" className="sr-only">
          {error}
        </span>
      ) : null}
    </>
  );
}

/** Text toggle for the area detail header, next to 보관. */
export function PinTextButton({ areaId, pinned }: { areaId: string; pinned: boolean }) {
  const { shown, pending, error, toggle } = usePin(areaId, pinned);
  return (
    <>
      <QuietButton
        onClick={toggle}
        disabled={pending}
        aria-pressed={shown}
        className="inline-flex items-center gap-1.5"
      >
        <PinIcon filled={shown} />
        {shown ? "고정 해제" : "사이드바에 고정"}
      </QuietButton>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </>
  );
}
