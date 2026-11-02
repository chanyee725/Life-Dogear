import type { AreaInput } from "@/lib/repo/areas";
import {
  formText,
  MAX_BODY,
  MAX_TEXT,
  MAX_TITLE,
  optionalStringList,
  optionalText,
  parseText,
} from "./parse";

/** Area form fields: `title`, `standard`, `body`, repeated `tags`. */
export function parseAreaForm(form: FormData): AreaInput {
  return {
    title: parseText(formText(form, "title") ?? "", "제목", MAX_TITLE),
    standard: optionalText(formText(form, "standard"), "유지 기준", MAX_TEXT),
    body: optionalText(formText(form, "body"), "본문", MAX_BODY),
    tags: optionalStringList(form.getAll("tags"), "태그"),
  };
}
