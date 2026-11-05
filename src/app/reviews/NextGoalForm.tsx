"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { safeAction } from "@/components/links/safe-action";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { createGoalFromReview } from "./actions";
import { itemPath } from "@/lib/item-path";

/**
 * Creates the next period's goal straight from a quarter/year review and links it.
 * Its own small form: it must not be nested in (or saved by) the review's autosave form.
 */
export function NextGoalForm({
  reviewId,
  targetLabel,
  parents,
}: {
  reviewId: string;
  /** e.g. "2027년 1분기 목표". */
  targetLabel: string;
  parents: readonly { id: string; title: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; title: string }[]>([]);

  return (
    <div className="flex flex-col gap-2">
      <form
        ref={formRef}
        aria-label={`${targetLabel} 만들기`}
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const title = String(data.get("title") ?? "").trim();
          setError(null);
          startTransition(async () => {
            const result = await safeAction(() => createGoalFromReview(reviewId, data));
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setCreated((list) => [...list, { id: result.data.id, title }]);
            formRef.current?.reset();
            router.refresh();
          });
        }}
      >
        <Input
          name="title"
          aria-label={`${targetLabel} 제목`}
          placeholder={`${targetLabel} 제목`}
          maxLength={300}
          required
          className="min-w-48 flex-1"
        />
        {parents.length ? (
          <Select name="parentId" aria-label="상위 목표" defaultValue="" className="w-auto">
            <option value="">상위 목표 없음</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        ) : null}
        <Button type="submit" size="sm" disabled={pending}>
          목표 만들기
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      {created.length ? (
        <ul className="flex flex-col gap-0.5 text-[13px]" aria-label="만든 목표">
          {created.map((g) => (
            <li key={g.id}>
              <Link href={itemPath("goals", g.id, g.title)} className="text-muted hover:text-fg">
                ✓ {g.title} →
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
