"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveItem, unarchiveItem } from "@/app/_actions/archive";
import { safeAction } from "@/components/links/safe-action";
import type { ItemRef } from "@/lib/repo/shared";
import { QuietButton } from "@/components/ui/Button";

/**
 * 보관 / 보관 해제 as a quiet text button. After archiving it goes to `redirectTo`
 * (usually the list, where the item is now hidden); otherwise it refreshes in place.
 */
export function ArchiveButton({
  item,
  archived,
  redirectTo,
  className,
}: {
  item: ItemRef;
  archived: boolean;
  /** Where to go after archiving. Omit to stay on the page. */
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await safeAction(() => (archived ? unarchiveItem(item) : archiveItem(item)));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!archived && redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <>
      <QuietButton onClick={toggle} disabled={pending} className={className}>
        {pending ? "처리 중…" : archived ? "보관 해제" : "보관"}
      </QuietButton>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </>
  );
}

/** Banner for archived items' detail pages. */
export function ArchivedNotice({ item }: { item: ItemRef }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-subtle px-3 py-2 text-[13px] text-muted">
      <span>보관된 항목입니다. 목록과 홈에는 보이지 않습니다.</span>
      <ArchiveButton item={item} archived />
    </div>
  );
}
