import type { ReviewKind } from "@/lib/enums";

/** "이번 주 회고 쓰기" etc. */
export const CURRENT_PERIOD_LABEL: Record<ReviewKind, string> = {
  week: "이번 주",
  month: "이번 달",
  quarter: "이번 분기",
  year: "올해",
};

export const KIND_TAB_LABEL: Record<ReviewKind, string> = {
  week: "주간",
  month: "월간",
  quarter: "분기",
  year: "연간",
};

/** First non-heading text line of a body, for list previews. */
export function bodyPreview(body: string): string {
  return (
    body
      .split("\n")
      .map((l) => l.replace(/^[#>\-*\s]+|\[[ x]\]\s*/g, "").trim())
      .find(Boolean) ?? ""
  );
}
