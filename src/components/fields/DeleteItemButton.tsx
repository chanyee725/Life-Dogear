"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ActionResult } from "@/app/_actions/result";
import { safeAction } from "@/components/links/safe-action";
import { ConfirmDialog, QuietButton } from "@/components/ui";

/** 삭제 button with a confirmation dialog; navigates to `redirectTo` after deleting. */
export function DeleteItemButton({
  action,
  redirectTo,
  itemLabel,
}: {
  action: () => Promise<ActionResult<null>>;
  redirectTo: string;
  /** Shown in the dialog, e.g. "이 연구". */
  itemLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    const result = await safeAction(action);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      <QuietButton onClick={() => setOpen(true)}>삭제</QuietButton>
      <ConfirmDialog
        open={open}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
        title={`${itemLabel}을(를) 삭제할까요?`}
        description={error ?? "연결과 태그도 함께 정리됩니다. 되돌릴 수 없습니다."}
        confirmLabel="삭제"
        danger
      />
    </>
  );
}
