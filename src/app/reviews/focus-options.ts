import { GOAL_STATUS, ITEM_TYPE } from "@/lib/enums";
import { goals, items, projects, type ItemRef } from "@/lib/repo";
import type { FocusOption } from "./FocusPicker";

const keyOf = (r: ItemRef) => `${r.type}:${r.id}`;

/**
 * Saved focus items that are no longer among the picker's choices (done, archived,
 * another period, deleted), labelled with why, so they can still be seen and cleared.
 */
export async function staleFocusOptions(
  focus: readonly ItemRef[],
  options: readonly FocusOption[],
): Promise<FocusOption[]> {
  const offered = new Set(options.map((o) => o.key));
  const stale = focus.filter((r) => !offered.has(keyOf(r)));
  if (!stale.length) return [];
  const heads = await items.getHeads(stale);
  return Promise.all(
    stale.map(async (r): Promise<FocusOption> => {
      const head = heads.get(keyOf(r));
      if (!head) return { key: keyOf(r), label: "삭제된 항목", hint: "(삭제됨)", gone: true };
      let reason = head.archived ? "보관" : null;
      if (!reason && r.type === "project") {
        reason = (await projects.get(r.id))?.status === "done" ? "완료" : null;
      }
      if (!reason && r.type === "goal") {
        const status = (await goals.get(r.id))?.status;
        reason = status && status !== "active" ? GOAL_STATUS.label(status) : "다른 기간";
      }
      return {
        key: keyOf(r),
        label: head.title,
        hint: `${ITEM_TYPE.label(r.type)} (${reason ?? "목록 밖"})`,
        stale: true,
      };
    }),
  );
}
