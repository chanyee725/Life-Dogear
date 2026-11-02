import {
  formText,
  MAX_BODY,
  MAX_TITLE,
  optionalEnum,
  optionalNullableText,
  optionalStringList,
  optionalText,
} from "@/app/_actions/parse";
import { hasListField } from "@/components/fields/form-patch";
import { PROJECT_STAGE } from "@/lib/enums";
import type { ProjectPatch } from "@/lib/repo/projects";

/**
 * Reads the project form as a patch. Absent fields (title included) stay undefined and
 * are left unchanged on update;
 * tags are sent only when the form has tag inputs or the `__present:tags` marker.
 */
export function parseProjectForm(form: FormData): ProjectPatch {
  return {
    title: optionalText(formText(form, "title"), "제목", MAX_TITLE),
    researchQuestion: optionalText(formText(form, "researchQuestion"), "연구 질문"),
    stage: optionalEnum(PROJECT_STAGE, formText(form, "stage"), "단계"),
    startDate: optionalNullableText(formText(form, "startDate"), "시작일"),
    dueDate: optionalNullableText(formText(form, "dueDate"), "마감일"),
    body: optionalText(formText(form, "body"), "본문", MAX_BODY),
    tags: hasListField(form, "tags") ? optionalStringList(form.getAll("tags"), "태그") : undefined,
  };
}
