"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setItemTags } from "@/app/_actions/tags";
import { deleteThought } from "@/app/thoughts/actions";
import { ArchiveButton } from "@/components/fields/ArchiveButton";
import { DeleteItemButton } from "@/components/fields/DeleteItemButton";
import { QuietButton } from "@/components/fields/ItemDetail";
import { TagInput } from "@/components/fields/TagInput";
import { LinkPicker } from "@/components/links/LinkPicker";
import { safeAction } from "@/components/links/safe-action";

/**
 * One inbox thought with quick actions. Tagging or linking files it (it leaves the
 * inbox); 보관 hides it; 삭제 removes it for good (after a confirmation). Each action
 * refreshes the page and the sidebar count.
 */
export function InboxItem({
  id,
  title,
  preview,
  created,
  tagSuggestions,
}: {
  id: string;
  title: string;
  preview: string;
  created: string;
  tagSuggestions: string[];
}) {
  const router = useRouter();
  const item = { type: "thought" as const, id };
  const [tagging, setTagging] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function saveTags() {
    if (names.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await safeAction(() => setItemTags(item, names));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/thoughts/${id}`}
            className="block truncate text-sm font-medium hover:underline"
          >
            {title}
          </Link>
          {preview ? <p className="line-clamp-2 text-[13px] text-muted">{preview}</p> : null}
        </div>
        <span className="shrink-0 text-xs text-muted tabular-nums">{created}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <QuietButton onClick={() => setTagging((v) => !v)} aria-expanded={tagging}>
          태그 달기
        </QuietButton>
        <LinkPicker item={item} label="연결" />
        <ArchiveButton item={item} archived={false} />
        {/* Apart from the filing actions: deleting can't be undone. */}
        <span className="ml-auto">
          <DeleteItemButton
            action={() => deleteThought(id)}
            redirectTo="/inbox"
            itemLabel="이 생각"
          />
        </span>
      </div>
      {tagging ? (
        <div className="flex items-center gap-2">
          <TagInput
            value={names}
            onChange={setNames}
            suggestions={tagSuggestions}
            placeholder="태그 입력 후 Enter"
            className="max-w-md"
          />
          <QuietButton onClick={saveTags} disabled={pending || names.length === 0}>
            {pending ? "저장 중…" : "태그 저장"}
          </QuietButton>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}
