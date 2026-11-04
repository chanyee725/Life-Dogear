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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span id={labelId} className="text-[13px] text-muted">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-1.5"
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
              title={t.description}
              className={cn(
                "h-8 rounded-full border px-3 text-[13px] transition-colors",
                checked
                  ? "border-accent bg-accent-soft font-medium text-fg"
                  : "border-border bg-bg text-muted hover:bg-hover hover:text-fg",
              )}
            >
              {t.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
