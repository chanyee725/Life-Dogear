"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { safeAction } from "@/components/links/safe-action";
import { QuietButton } from "@/components/fields/ItemDetail";
import { setReviewCompleted } from "./actions";

/** 작성 완료 ↔ 다시 쓰기. Completing saves a fresh goal progress snapshot. */
export function CompleteButton({ id, completed }: { id: string; completed: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <QuietButton
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await safeAction(() => setReviewCompleted(id, !completed));
            if (!result.ok) setError(result.error);
            else router.refresh();
          });
        }}
      >
        {completed ? "다시 쓰기" : "작성 완료"}
      </QuietButton>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </>
  );
}
