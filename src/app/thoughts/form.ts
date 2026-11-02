import {
  formText,
  MAX_BODY,
  MAX_TITLE,
  optionalEnum,
  optionalStringList,
  optionalText,
} from "@/app/_actions/parse";
import { hasListField } from "@/components/fields/form-patch";
import { THOUGHT_KIND, THOUGHT_MATURITY } from "@/lib/enums";
import type { ThoughtPatch } from "@/lib/repo/thoughts";

export function parseThoughtForm(form: FormData): ThoughtPatch {
  return {
    title: optionalText(formText(form, "title"), "제목", MAX_TITLE),
    kind: optionalEnum(THOUGHT_KIND, formText(form, "kind"), "종류"),
    maturity: optionalEnum(THOUGHT_MATURITY, formText(form, "maturity"), "발전 정도"),
    body: optionalText(formText(form, "body"), "본문", MAX_BODY),
    tags: hasListField(form, "tags") ? optionalStringList(form.getAll("tags"), "태그") : undefined,
  };
}
