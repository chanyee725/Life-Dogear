import { buttonClass } from "./Button";
import { EmptyAdd } from "./EmptyAdd";
import { EmptyState } from "./EmptyState";
import Link from "next/link";

/**
 * The one empty body of a list page. Unfiltered: a single `＋ 새 …` line (the same
 * rule as detail sections; no filled button duplicating the header action).
 * Filtered: a short notice with a way back.
 */
export function ListEmpty({
  filtered,
  addHref,
  addLabel,
  clearHref,
}: {
  filtered?: boolean;
  addHref: string;
  /** e.g. "＋ 새 노트" */
  addLabel: string;
  clearHref: string;
}) {
  if (filtered) {
    return (
      <EmptyState
        title={"조건에 맞는 항목이 없습니다"}
        action={
          <Link href={clearHref} className={buttonClass("secondary", "sm")}>
            필터 해제
          </Link>
        }
      />
    );
  }
  return (
    <EmptyAdd compact href={addHref}>
      {addLabel}
    </EmptyAdd>
  );
}
