"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { safeAction } from "@/components/links/safe-action";
import { QuietButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui";
import { deletePaper } from "../actions";

export function DeletePaperButton({ paperId, title }: { paperId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <QuietButton onClick={() => setOpen(true)}>삭제</QuietButton>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
      <ConfirmDialog
        open={open}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          const result = await safeAction(() => deletePaper(paperId));
          setOpen(false);
          if (result.ok) {
            router.push("/papers");
          } else {
            setError(result.error);
          }
        }}
        title="논문을 삭제할까요?"
        description={`“${title}”과 PDF, 연결, 태그가 함께 삭제되며 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        danger
      />
    </>
  );
}
