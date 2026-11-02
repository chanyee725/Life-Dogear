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
import { SEMINAR_KIND } from "@/lib/enums";
import type { SeminarInput } from "@/lib/repo/seminars";

export function parseSeminarForm(form: FormData): SeminarInput {
  return {
    title: parseText(formText(form, "title") ?? "", "제목", MAX_TITLE),
    date: optionalNullableText(formText(form, "date"), "날짜"),
    speaker: optionalText(formText(form, "speaker"), "연사"),
    hostVenue: optionalText(formText(form, "hostVenue"), "주최·장소"),
    kind: optionalEnum(SEMINAR_KIND, formText(form, "kind"), "종류"),
    keyLine: optionalText(formText(form, "keyLine"), "핵심 한 줄"),
    materialUrl: optionalText(formText(form, "materialUrl"), "자료 링크"),
    body: optionalText(formText(form, "body"), "본문", MAX_BODY),
    tags: optionalStringList(form.getAll("tags"), "태그"),
  };
}
