"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { unlinkItems } from "@/app/_actions/links";
import { Button } from "@/components/ui";
import type { ItemRef } from "@/lib/repo/shared";

/** Small "연결 해제" button for one connected item. */
export function UnlinkButton({
  item,
  other,
  otherTitle,
}: {
  item: ItemRef;
  other: ItemRef;
  otherTitle: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex shrink-0 items-center gap-2">
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={`"${otherTitle}" 연결 해제`}
        className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await unlinkItems(item, other);
            if (res.ok) router.refresh();
            else setError(res.error);
          })
        }
      >
        {pending ? "해제 중…" : "연결 해제"}
      </Button>
    </span>
  );
}
