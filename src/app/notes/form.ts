import {
  formText,
  MAX_BODY,
  MAX_TITLE,
  optionalNullableText,
  optionalStringList,
  optionalText,
} from "@/app/_actions/parse";
import { hasListField } from "@/components/fields/form-patch";
import { NOTE_SOURCE_KIND } from "@/lib/enums";
import { RepoError } from "@/lib/repo";
import type { NotePatch } from "@/lib/repo/notes";

/** "" or missing kind clears it (출처 종류 is optional); anything else must be a known kind. */
function optionalSourceKind(value: string | undefined): NotePatch["sourceKind"] {
  if (value === undefined) return undefined;
  if (value === "") return null;
  if (!NOTE_SOURCE_KIND.is(value))
    throw new RepoError("invalid", "출처 종류 값이 올바르지 않습니다.");
  return value;
}

/** Fields not sent stay as they are; `sourceUrl` is checked for http(s) by the repo. */
export function parseNoteForm(form: FormData): NotePatch {
  return {
    title: optionalText(formText(form, "title"), "제목", MAX_TITLE),
    body: optionalText(formText(form, "body"), "본문", MAX_BODY),
    sourceKind: optionalSourceKind(formText(form, "sourceKind")),
    sourceTitle: optionalNullableText(formText(form, "sourceTitle"), "출처 이름"),
    sourceUrl: optionalNullableText(formText(form, "sourceUrl"), "출처 링크"),
    areaId: optionalNullableText(formText(form, "areaId"), "영역"),
    tags: hasListField(form, "tags") ? optionalStringList(form.getAll("tags"), "태그") : undefined,
  };
}
