"use client";

import { useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { FOCUS_FIELD } from "./form";

export type FocusOption = { key: string; label: string; hint?: string };

/**
 * "다음 주 집중 3가지": pick up to `max` items. Writes `type:id,…` into a hidden input
 * and fires a bubbling `input` event so the autosave form notices.
 */
export function FocusPicker({
  options,
  defaultValue,
  max = 3,
}: {
  options: readonly FocusOption[];
  defaultValue: readonly string[];
  max?: number;
}) {
  const [selected, setSelected] = useState<string[]>(() => [...defaultValue]);
  const inputRef = useRef<HTMLInputElement>(null);

  function toggle(key: string) {
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : selected.length < max
        ? [...selected, key]
        : selected;
    if (next === selected) return;
    setSelected(next);
    const input = inputRef.current;
    if (input) {
      input.value = next.join(",");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  const full = selected.length >= max;
  return (
    <div className="flex flex-col gap-2">
      <input ref={inputRef} type="hidden" name={FOCUS_FIELD} defaultValue={selected.join(",")} />
      <p className="text-xs text-muted tabular-nums" aria-live="polite">
        {selected.length}/{max} 선택
      </p>
      {options.length ? (
        <ul className="flex flex-col gap-1">
          {options.map((o) => {
            const checked = selected.includes(o.key);
            const id = `focus-${o.key.replace(/[^a-z0-9-]/gi, "-")}`;
            return (
              <li key={o.key}>
                <label
                  htmlFor={id}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-hover",
                    !checked && full && "opacity-50",
                  )}
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && full}
                    onChange={() => toggle(o.key)}
                    // Not a form field itself: the hidden input carries the value.
                    form="__none"
                  />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint ? <span className="shrink-0 text-xs text-muted">{o.hint}</span> : null}
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">고를 수 있는 진행 중 프로젝트나 목표가 없습니다.</p>
      )}
    </div>
  );
}
