"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { createQuickThought } from "@/app/_actions/quick-thought";
import { createTask } from "@/app/_actions/tasks";
import { shortDay } from "@/components/calendar/model";
import { safeAction } from "@/components/links/safe-action";
import { QUICK_INPUT_ID } from "@/components/shell/shortcuts";
import { cn, controlClass, Kbd } from "@/components/ui";

type Saved = { ok: true } | { ok: false; error: string };

/**
 * One-line input that saves on Enter (empty → nothing, IME composing → ignored) and keeps
 * focus so the next entry can follow. The status line under it says saved / failed.
 */
function EnterInput({
  id,
  label,
  placeholder,
  maxLength,
  savedText,
  adornment,
  save,
}: {
  id?: string;
  label: string;
  placeholder: string;
  maxLength: number;
  savedText: string;
  /** Quiet hint at the right edge (the `/` key, the due day). */
  adornment?: ReactNode;
  save: (text: string) => Promise<Saved>;
}) {
  const statusId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    const text = value.trim();
    if (!text || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await save(text);
      if (result.ok) {
        setValue("");
        setSaved(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="relative">
        <input
          id={id}
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
          aria-label={label}
          aria-describedby={statusId}
          placeholder={placeholder}
          maxLength={maxLength}
          // readOnly (not disabled) keeps focus after Enter so the next entry can follow.
          readOnly={pending}
          aria-busy={pending || undefined}
          className={cn(controlClass, "h-10 pr-16")}
        />
        {adornment ? (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
            {adornment}
          </span>
        ) : null}
      </div>
      <p
        id={statusId}
        aria-live="polite"
        className={cn("min-h-4 text-xs", error ? "text-danger" : "text-muted")}
      >
        {error ?? (pending ? "저장 중…" : saved ? savedText : "")}
      </p>
    </div>
  );
}

/** 생각 추가: Enter saves the text as a thought (메모 · 씨앗) in the inbox. `/` focuses it. */
export function QuickInput() {
  return (
    <EnterInput
      id={QUICK_INPUT_ID}
      label="생각 추가 (Enter로 수집함에 저장)"
      placeholder="생각 추가"
      maxLength={10_000}
      savedText="생각으로 저장했습니다."
      adornment={<Kbd>/</Kbd>}
      save={async (text) => {
        const result = await safeAction(() => createQuickThought(text));
        return result.ok ? { ok: true } : result;
      }}
    />
  );
}

/** Day hint shown in the 할 일 추가 input: "오늘" or "11월 6일". */
export function dueHint(day: string, today: string): string {
  return day === today ? "오늘" : shortDay(day);
}

/**
 * 할 일 추가: Enter creates a task with no parent, due on `day` (the day selected in the home
 * calendar). The action revalidates `/`, so the calendar and today panel pick it up.
 */
export function TaskQuickInput({ day, today }: { day: string; today: string }) {
  const hint = dueHint(day, today);
  return (
    <EnterInput
      // Label avoids "생각" so it never reads as the thought input.
      label={`할 일 추가 (Enter로 ${shortDay(day)} 마감)`}
      placeholder="할 일 추가"
      maxLength={300}
      savedText={`${hint} 마감으로 추가했습니다.`}
      adornment={<span className="text-xs text-muted tabular-nums">{hint}</span>}
      save={async (title) => {
        const result = await safeAction(() => createTask({ title, parent: null, dueDate: day }));
        return result.ok ? { ok: true } : result;
      }}
    />
  );
}
