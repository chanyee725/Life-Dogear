import { formText, MAX_BODY, optionalText } from "@/app/_actions/parse";
import { RepoError } from "@/lib/repo";
import type { ReviewPatch } from "@/lib/repo/reviews";

/** Hidden input of the focus picker: `type:id` refs joined by commas (empty = none). */
export const FOCUS_FIELD = "focus";
const MAX_FOCUS_FIELD = 400;

/** `"project:…,goal:…"` → refs (validated again by the repo). */
export function parseFocusField(value: string): { type: string; id: string }[] {
  if (value.length > MAX_FOCUS_FIELD)
    throw new RepoError("invalid", "집중할 항목이 올바르지 않습니다.");
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const at = s.indexOf(":");
      return { type: s.slice(0, at), id: at > 0 ? s.slice(at + 1) : "" };
    });
}

export function parseReviewForm(form: FormData): ReviewPatch {
  const focus = formText(form, FOCUS_FIELD);
  return {
    body: optionalText(formText(form, "body"), "본문", MAX_BODY),
    focus: focus === undefined ? undefined : parseFocusField(focus),
  };
}
