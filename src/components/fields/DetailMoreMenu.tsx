"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/_actions/result";
import { archiveItem, unarchiveItem } from "@/app/_actions/archive";
import { safeAction } from "@/components/links/safe-action";
import { ConfirmDialog } from "@/components/ui";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/Menu";
import type { ItemRef } from "@/lib/repo/shared";

/**
 * "⋯" menu for a detail page header: 보관 / 보관 해제 and 삭제 (destructive, asks first).
 * Replaces the loose 보관 · 삭제 text buttons so 저장 is the only emphasised action.
 */
export function DetailMoreMenu({
  item,
  archived = false,
  redirectTo,
  deleteAction,
  itemLabel,
  deleteDescription,
  stayAfterArchive = false,
}: {
  item: ItemRef;
  archived?: boolean;
  /** Where to go after archiving or deleting (the list page). */
  redirectTo: string;
  deleteAction: () => Promise<ActionResult<unknown>>;
  /** Dialog title subject, e.g. "이 프로젝트". */
  itemLabel: string;
  deleteDescription?: string;
  /** Refresh in place after archiving instead of going to `redirectTo` (papers show a notice). */
  stayAfterArchive?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function archive() {
    setError(null);
    startTransition(async () => {
      const result = await safeAction(() => (archived ? unarchiveItem(item) : archiveItem(item)));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!archived && !stayAfterArchive) router.push(redirectTo);
      else router.refresh();
    });
  }

  async function confirmDelete() {
    setError(null);
    const result = await safeAction(deleteAction);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirming(false);
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      {error && !confirming ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="더보기"
            disabled={pending}
            className="grid size-7 shrink-0 place-items-center rounded-md text-base leading-none text-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-50"
          >
            <span aria-hidden>⋯</span>
          </button>
        </MenuTrigger>
        <MenuContent align="end" aria-label="더보기">
          <MenuItem onSelect={archive}>{archived ? "보관 해제" : "보관"}</MenuItem>
          <MenuItem danger onSelect={() => setConfirming(true)}>
            삭제
          </MenuItem>
        </MenuContent>
      </Menu>
      <ConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={confirmDelete}
        title={`${itemLabel}을(를) 삭제할까요?`}
        description={
          error ?? deleteDescription ?? "연결과 태그도 함께 정리됩니다. 되돌릴 수 없습니다."
        }
        confirmLabel="삭제"
        danger
      />
    </>
  );
}
