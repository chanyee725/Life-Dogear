"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { unlinkItems } from "@/app/_actions/links";
import { Button } from "@/components/ui";
import type { ItemRef } from "@/lib/repo/shared";
import { safeAction } from "./safe-action";
import { Tooltip } from "@/components/ui/Tooltip";

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
      <Tooltip content={`"${otherTitle}" 연결 해제`}>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-busy={pending}
          className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await safeAction(
                () => unlinkItems(item, other),
                "연결을 해제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
              );
              if (res.ok) router.refresh();
              else setError(res.error);
            })
          }
        >
          연결 해제
        </Button>
      </Tooltip>
    </span>
  );
}
