import {
  formText,
  MAX_BODY,
  MAX_TITLE,
  optionalEnum,
  optionalStringList,
  optionalText,
  parseText,
} from "@/app/_actions/parse";
import { THOUGHT_KIND, THOUGHT_MATURITY } from "@/lib/enums";
import type { ThoughtInput } from "@/lib/repo/thoughts";

export function parseThoughtForm(form: FormData): ThoughtInput {
  return {
    title: parseText(formText(form, "title") ?? "", "제목", MAX_TITLE),
    kind: optionalEnum(THOUGHT_KIND, formText(form, "kind"), "종류"),
    maturity: optionalEnum(THOUGHT_MATURITY, formText(form, "maturity"), "발전 정도"),
    body: optionalText(formText(form, "body"), "본문", MAX_BODY),
    tags: optionalStringList(form.getAll("tags"), "태그"),
  };
}
