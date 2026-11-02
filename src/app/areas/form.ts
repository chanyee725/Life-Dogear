import {
  formText,
  MAX_BODY,
  MAX_TEXT,
  MAX_TITLE,
  optionalStringList,
  optionalText,
} from "@/app/_actions/parse";
import { hasListField } from "@/components/fields/form-patch";
import type { AreaPatch } from "@/lib/repo/areas";

/**
 * Area form as a patch (for autosave): absent fields, title included, stay undefined;
 * tags only when sent (tag inputs or the `__present:tags` marker).
 */
export function parseAreaPatch(form: FormData): AreaPatch {
  return {
    title: optionalText(formText(form, "title"), "제목", MAX_TITLE),
    standard: optionalText(formText(form, "standard"), "유지 기준", MAX_TEXT),
    body: optionalText(formText(form, "body"), "본문", MAX_BODY),
    tags: hasListField(form, "tags") ? optionalStringList(form.getAll("tags"), "태그") : undefined,
  };
}
