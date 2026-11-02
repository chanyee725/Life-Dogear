"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveItem, unarchiveItem } from "@/app/_actions/archive";
import { safeAction } from "@/components/links/safe-action";
import { Button } from "@/components/ui";

/**
 * "보관" / "보관 해제" for a paper. Archived papers drop out of lists, home and the
 * link picker but keep their data; the page itself stays open.
 */
export function ArchivePaperButton({ paperId, archived }: { paperId: string; archived: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const ref = { type: "paper" as const, id: paperId };
      const result = await safeAction(() => (archived ? unarchiveItem(ref) : archiveItem(ref)));
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
      <Button variant="ghost" onClick={toggle} disabled={pending}>
        {pending ? "처리 중…" : archived ? "보관 해제" : "보관"}
      </Button>
    </>
  );
}
