"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { EDITOR_READY_EVENT } from "@/components/fields/form-patch";
import { cn } from "@/components/ui/cn";
import {
  DEFAULT_NOTE_TEMPLATE,
  NOTE_TEMPLATES,
  noteTemplate,
  type NoteTemplateKey,
} from "@/lib/templates";
import { NoteFields, type NoteFormValues } from "../NoteFields";
import {
  canReplaceBody,
  chooseTemplate,
  initialChoice,
  KEPT_BODY_NOTICE,
  nextIndex,
} from "./template-choice";

/**
 * The new-note fields with a template picker above them (docs/design/code.md 4).
 * Picking a template fills the body, unless the user has already written their own text.
 */
export function NewNoteFields({
  values,
  today,
  tagSuggestions,
  areaOptions,
}: {
  values: Omit<NoteFormValues, "body">;
  /** Seoul date `YYYY-MM-DD`, for the work log heading. */
  today: string;
  tagSuggestions: string[];
  areaOptions: { value: string; label: string }[];
}) {
  const [choice, setChoice] = useState(() => initialChoice(DEFAULT_NOTE_TEMPLATE));
  const [announce, setAnnounce] = useState("");
  const root = useRef<HTMLDivElement>(null);
  // The body as the editor serialised it right after loading the applied template.
  const baseline = useRef<string | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onReady = (event: Event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement && input.name === "body")
        baseline.current = input.value;
    };
    el.addEventListener(EDITOR_READY_EVENT, onReady);
    return () => el.removeEventListener(EDITOR_READY_EVENT, onReady);
  }, []);

  function currentBody(): string {
    const form = root.current?.closest("form");
    // `new FormData(form)` makes the editor write its exact Markdown (see HiddenValue).
    return form ? String(new FormData(form).get("body") ?? "") : "";
  }

  function choose(key: NoteTemplateKey) {
    if (key === choice.selected) return;
    const next = chooseTemplate(choice, key, canReplaceBody(currentBody(), baseline.current));
    if (next.revision !== choice.revision) baseline.current = null;
    setChoice(next);
    setAnnounce(`템플릿: ${noteTemplate(key).name}`);
  }

  return (
    <div ref={root} className="contents">
      <div className="flex flex-col gap-1.5">
        <TemplatePicker selected={choice.selected} onChoose={choose} />
        <p aria-live="polite" className="min-h-[1lh] text-[12px] text-muted">
          {choice.skipped ? KEPT_BODY_NOTICE : ""}
        </p>
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      <NoteFields
        // A new key remounts the editor with the template body.
        editorKey={`new-${choice.revision}`}
        tagSuggestions={tagSuggestions}
        areaOptions={areaOptions}
        values={{ ...values, body: noteTemplate(choice.applied).body(today) }}
      />
    </div>
  );
}

function TemplatePicker({
  selected,
  onChoose,
}: {
  selected: NoteTemplateKey;
  onChoose: (key: NoteTemplateKey) => void;
}) {
  const cards = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = NOTE_TEMPLATES.findIndex((t) => t.key === selected);
    const next = nextIndex(event.key, index, NOTE_TEMPLATES.length);
    if (next === null) return;
    event.preventDefault();
    onChoose(NOTE_TEMPLATES[next]!.key);
    cards.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <span id="note-template-label" className="text-[13px] text-muted">
        템플릿
      </span>
      <div
        role="radiogroup"
        aria-labelledby="note-template-label"
        onKeyDown={onKeyDown}
        className="flex flex-col gap-2 sm:flex-row"
      >
        {NOTE_TEMPLATES.map((t, i) => {
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
                "flex min-h-[56px] flex-1 flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors",
                checked ? "border-accent bg-accent-soft" : "border-border bg-bg hover:bg-hover",
              )}
            >
              <span className="text-[14px] font-medium text-fg">{t.name}</span>
              <span className="text-[12px] text-muted">{t.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
