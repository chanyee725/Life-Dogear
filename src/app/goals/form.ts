import {
  formText,
  MAX_BODY,
  MAX_TEXT,
  MAX_TITLE,
  optionalEnum,
  optionalInt,
  optionalNullableText,
  optionalStringList,
  optionalText,
} from "@/app/_actions/parse";
import { hasListField } from "@/components/fields/form-patch";
import { GOAL_HORIZON, GOAL_PROGRESS_MODE, GOAL_STATUS } from "@/lib/enums";
import type { GoalPatch } from "@/lib/repo/goals";

/**
 * Goal form as a patch: absent fields (title included) stay undefined; "" clears
 * parent, area, period and manual progress. Shape rules live in the repo.
 */
export function parseGoalForm(form: FormData): GoalPatch {
  return {
    title: optionalText(formText(form, "title"), "제목", MAX_TITLE),
    horizon: optionalEnum(GOAL_HORIZON, formText(form, "horizon"), "기간 단위"),
    period: optionalNullableText(formText(form, "period"), "기간", 20),
    parentId: optionalNullableText(formText(form, "parentId"), "상위 목표"),
    areaId: optionalNullableText(formText(form, "areaId"), "영역"),
    why: optionalText(formText(form, "why"), "왜", MAX_TEXT),
    status: optionalEnum(GOAL_STATUS, formText(form, "status"), "상태"),
    progressMode: optionalEnum(GOAL_PROGRESS_MODE, formText(form, "progressMode"), "진행률 방식"),
    manualProgress: optionalInt(formText(form, "manualProgress"), "진행률"),
    body: optionalText(formText(form, "body"), "본문", MAX_BODY),
    tags: hasListField(form, "tags") ? optionalStringList(form.getAll("tags"), "태그") : undefined,
  };
}
