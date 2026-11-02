"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createRecommendedAreas } from "@/app/_actions/areas";
import { safeAction } from "@/components/links/safe-action";
import { RECOMMENDED_AREAS } from "@/lib/enums";

/**
 * Shown in the sidebar while there are no areas: pick any of the four suggested areas
 * and create them. Nothing is created automatically.
 */
export function RecommendedAreas() {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function create() {
    setMessage(null);
    startTransition(async () => {
      const result = await safeAction(() => createRecommendedAreas(picked));
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      const archived = result.data.skipped.filter((a) => a.archived).map((a) => a.title);
      if (archived.length > 0) {
        setMessage(
          `${archived.join(", ")}: 보관된 같은 이름의 영역이 있습니다. 보관함에서 해제하세요.`,
        );
      }
      setPicked([]);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-2 text-[13px]">
      <p className="text-xs text-muted">추천 영역을 골라 만들 수 있어요.</p>
      {RECOMMENDED_AREAS.map((area) => (
        <label
          key={area.title}
          className="flex items-center gap-2 text-muted"
          title={area.standard}
        >
          <input
            type="checkbox"
            checked={picked.includes(area.title)}
            onChange={(e) =>
              setPicked((prev) =>
                e.target.checked ? [...prev, area.title] : prev.filter((t) => t !== area.title),
              )
            }
            className="accent-accent"
          />
          {area.title}
        </label>
      ))}
      <button
        type="button"
        onClick={create}
        disabled={pending || picked.length === 0}
        className="mt-1 h-7 rounded-md bg-subtle text-[13px] text-fg hover:bg-hover disabled:opacity-50"
      >
        {pending ? "만드는 중…" : "선택한 영역 만들기"}
      </button>
      {message ? (
        <p role="alert" className="text-xs text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
