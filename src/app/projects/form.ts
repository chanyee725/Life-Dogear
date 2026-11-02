import {
  formText,
  MAX_BODY,
  MAX_TITLE,
  optionalEnum,
  optionalNullableText,
  optionalStringList,
  optionalText,
  parseText,
} from "@/app/_actions/parse";
import { PROJECT_STAGE } from "@/lib/enums";
import type { ProjectInput } from "@/lib/repo/projects";

/** Reads the project form. Every field the form renders is required to be present except tags. */
export function parseProjectForm(form: FormData): ProjectInput {
  return {
    title: parseText(formText(form, "title") ?? "", "제목", MAX_TITLE),
    researchQuestion: optionalText(formText(form, "researchQuestion"), "연구 질문"),
    stage: optionalEnum(PROJECT_STAGE, formText(form, "stage"), "단계"),
    startDate: optionalNullableText(formText(form, "startDate"), "시작일"),
    dueDate: optionalNullableText(formText(form, "dueDate"), "마감일"),
    body: optionalText(formText(form, "body"), "본문", MAX_BODY),
    tags: optionalStringList(form.getAll("tags"), "태그"),
  };
}
