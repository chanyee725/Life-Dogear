"use client";

import { useId, useState, useTransition } from "react";
import type { ActionResult } from "@/app/_actions/result";
import { lookupPaperMetadata } from "@/app/_actions/metadata";
import { safeAction } from "@/components/links/safe-action";
import { Button, cn, Input, Spinner } from "@/components/ui";
import { METADATA_INPUT_PLACEHOLDER } from "@/lib/metadata/messages";
import type { PaperMetadata } from "@/lib/metadata/types";

type Lookup = (input: string) => Promise<ActionResult<PaperMetadata>>;

export type FillFromLinkProps = {
  /** Receives the looked-up record; the caller decides which fields to fill. */
  onFill: (meta: PaperMetadata) => void;
  /** Injected for tests/storybooks; defaults to the server action. */
  lookup?: Lookup;
  className?: string;
};

/**
 * "링크로 채우기": a DOI / arXiv link box with a button. Enter or the button looks
 * the link up and passes the result to `onFill`. Not a `<form>`, so it can sit
 * inside another form (e.g. the new-paper form) without submitting it.
 */
export function FillFromLink({
  onFill,
  lookup = lookupPaperMetadata,
  className,
}: FillFromLinkProps) {
  const inputId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    const text = value.trim();
    if (!text || pending) return;
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await safeAction(() => lookup(text));
      if (result.ok) {
        onFill(result.data);
        setDone(`“${result.data.title}” 정보를 채웠습니다.`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-[13px] font-medium text-muted">
        링크로 채우기
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              run();
            }
          }}
          placeholder={METADATA_INPUT_PLACEHOLDER}
          maxLength={500}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${inputId}-status`}
          disabled={pending}
        />
        <Button onClick={run} disabled={pending || !value.trim()}>
          {pending ? <Spinner /> : null}
          {pending ? "가져오는 중…" : "채우기"}
        </Button>
      </div>
      <p id={`${inputId}-status`} aria-live="polite" className="min-h-4 text-xs">
        {error ? (
          <span role="alert" className="text-danger">
            {error}
          </span>
        ) : done ? (
          <span className="text-faint">{done}</span>
        ) : null}
      </p>
    </div>
  );
}
