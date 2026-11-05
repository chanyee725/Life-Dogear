"use client";

import { useState } from "react";
import { useTemplateBody } from "@/components/fields/useTemplateBody";
import { KEPT_BODY_NOTICE, TemplatePicker } from "@/components/ui";
import {
  DEFAULT_NOTE_TEMPLATE,
  NOTE_TEMPLATES,
  noteTemplate,
  type NoteTemplateKey,
} from "@/lib/templates";
import { NoteFields, type NoteFormValues } from "../NoteFields";

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
  const { root, choice, choose } = useTemplateBody<NoteTemplateKey>(DEFAULT_NOTE_TEMPLATE);
  const [announce, setAnnounce] = useState("");

  function onChoose(key: NoteTemplateKey) {
    if (choose(key)) setAnnounce(`템플릿: ${noteTemplate(key).name}`);
  }

  return (
    <div ref={root} className="contents">
      <div className="flex flex-col gap-1.5">
        <TemplatePicker templates={NOTE_TEMPLATES} selected={choice.selected} onChoose={onChoose} />
        <p aria-live="polite" className="min-h-[1lh] text-xs text-muted">
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
