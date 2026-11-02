"use client";

import { useState, useTransition } from "react";
import { createQuickThought } from "@/app/_actions/quick-thought";
import { safeAction } from "@/components/links/safe-action";
import { QUICK_INPUT_ID } from "@/components/shell/shortcuts";
import { cn, controlClass, Kbd } from "@/components/ui";

/** Home quick input: Enter saves the text as a thought (메모 · 씨앗). */
export function QuickInput() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    const text = value.trim();
    if (!text || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await safeAction(() => createQuickThought(text));
      if (result.ok) {
        setValue("");
        setSaved(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <input
          id={QUICK_INPUT_ID}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          onKeyDown={(e) => {
            // keyCode 229: Safari reports the IME-confirming Enter this way.
            const composing = e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229;
            if (e.key === "Enter" && !composing) {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              e.currentTarget.blur();
            }
          }}
          aria-label="빠른 입력 (Enter로 생각 저장)"
          aria-describedby="quick-input-status"
          placeholder="떠오른 생각을 적고 Enter"
          maxLength={10_000}
          // readOnly (not disabled) keeps focus after Enter so the next thought can follow.
          readOnly={pending}
          aria-busy={pending || undefined}
          className={cn(controlClass, "h-11 pr-12 text-[15px]")}
        />
        <Kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">/</Kbd>
      </div>
      <p
        id="quick-input-status"
        aria-live="polite"
        className={cn("min-h-4 text-xs", error ? "text-danger" : "text-muted")}
      >
        {error ?? (pending ? "저장 중…" : saved ? "생각으로 저장했습니다." : "")}
      </p>
    </div>
  );
}
