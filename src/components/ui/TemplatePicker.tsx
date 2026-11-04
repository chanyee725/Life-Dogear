"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { cn } from "./cn";
import { nextIndex } from "./template-choice";

export type TemplateOption<K extends string> = {
  key: K;
  name: string;
  /** One short line under the name; omit when the name says enough. */
  description?: string;
};

/**
 * Template cards as a radio group (new note / new project). Arrow keys move and choose,
 * wrapping; Home/End jump to the ends. Only the checked card is in the Tab order.
 */
export function TemplatePicker<K extends string>({
  templates,
  selected,
  onChoose,
  label = "템플릿",
}: {
  templates: readonly TemplateOption<K>[];
  selected: K;
  onChoose: (key: K) => void;
  label?: string;
}) {
  const labelId = useId();
  const cards = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = templates.findIndex((t) => t.key === selected);
    const next = nextIndex(event.key, index, templates.length);
    if (next === null) return;
    event.preventDefault();
    onChoose(templates[next]!.key);
    cards.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-[13px] text-muted">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-2 sm:flex-row"
      >
        {templates.map((t, i) => {
          const checked = t.key === selected;
          return (
            <button
              key={t.key}
              ref={(el) => {
                cards.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChoose(t.key)}
              className={cn(
                "flex flex-1 flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors",
                t.description ? "min-h-[56px]" : "min-h-[40px] justify-center",
                checked ? "border-accent bg-accent-soft" : "border-border bg-bg hover:bg-hover",
              )}
            >
              <span className="text-[14px] font-medium text-fg">{t.name}</span>
              {t.description ? (
                <span className="text-[12px] text-muted">{t.description}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
