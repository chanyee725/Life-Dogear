"use client";

import { useState } from "react";
import { useTemplateBody } from "@/components/fields/useTemplateBody";
import { KEPT_BODY_NOTICE, TemplatePicker } from "@/components/ui";
import type { ProjectKind } from "@/lib/enums";
import {
  defaultProjectTemplate,
  PROJECT_TEMPLATES,
  projectKindAfter,
  projectTemplate,
  type ProjectTemplateKey,
} from "@/lib/templates";
import { ProjectFields, type ProjectFormValues } from "../ProjectFields";

/**
 * The new-project fields with a template picker above them. A template fills the body
 * (unless the user has written their own) and sets 종류; 빈 페이지 keeps the 종류.
 */
export function NewProjectFields({
  values,
  tagSuggestions,
  areaOptions,
  goalOptions,
}: {
  values: Omit<ProjectFormValues, "body">;
  tagSuggestions: string[];
  areaOptions: { value: string; label: string }[];
  goalOptions: { value: string; label: string }[];
}) {
  const { root, choice, choose } = useTemplateBody<ProjectTemplateKey>(
    defaultProjectTemplate(values.kind),
  );
  const [kind, setKind] = useState<ProjectKind>(values.kind);
  const [announce, setAnnounce] = useState("");

  function onChoose(key: ProjectTemplateKey) {
    if (!choose(key)) return;
    setKind((current) => projectKindAfter(key, current));
    setAnnounce(`템플릿: ${projectTemplate(key).name}`);
  }

  return (
    <div ref={root} className="contents">
      <div className="flex flex-col gap-1.5">
        <TemplatePicker
          templates={PROJECT_TEMPLATES}
          selected={choice.selected}
          onChoose={onChoose}
        />
        <p aria-live="polite" className="min-h-[1lh] text-xs text-muted">
          {choice.skipped ? KEPT_BODY_NOTICE : ""}
        </p>
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      <ProjectFields
        // A new key remounts the editor with the template body.
        editorKey={`new-${choice.revision}`}
        tagSuggestions={tagSuggestions}
        areaOptions={areaOptions}
        goalOptions={goalOptions}
        onKindChange={setKind}
        values={{ ...values, kind, body: projectTemplate(choice.applied).body }}
      />
    </div>
  );
}
