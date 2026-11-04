"use client";

import { useEffect, useRef, useState } from "react";
import { canReplaceBody, chooseTemplate, initialChoice } from "@/components/ui/template-choice";
import { EDITOR_READY_EVENT } from "./form-patch";

/**
 * State for a template picker that fills the body editor of the surrounding form
 * (new note / new project). A choice replaces the body only while the user has not
 * written their own text (`canReplaceBody`); otherwise `choice.skipped` is set.
 * Attach `root` to an element inside the form that contains the editor.
 */
export function useTemplateBody<K extends string>(initial: K) {
  const [choice, setChoice] = useState(() => initialChoice(initial));
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

  /** Picks `key`; returns false when it is already selected (nothing changed). */
  function choose(key: K): boolean {
    if (key === choice.selected) return false;
    const next = chooseTemplate(choice, key, canReplaceBody(currentBody(), baseline.current));
    if (next.revision !== choice.revision) baseline.current = null;
    setChoice(next);
    return true;
  }

  return { root, choice, choose };
}
