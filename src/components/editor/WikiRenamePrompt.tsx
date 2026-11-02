"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { countWikiMentions, renameWikiMentions } from "@/app/_actions/wikilinks";
import { safeAction } from "@/components/links/safe-action";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { ItemRef } from "@/lib/repo/shared";
import { cleanTitle, titleKey } from "@/lib/wikilinks";
import { invalidateWikiTitles } from "./wiki-resolver";

/** Wait after the last title edit: long enough for the title autosave to land. */
export const RENAME_CHECK_DELAY = 2000;

type Ask = { from: string; to: string; count: number };

/**
 * After the item's title changes, offers to rewrite `[[옛 제목]]` → `[[새 제목]]` in the
 * bodies of linked items ("바꾸기" is the default button). Pass the current title text;
 * the prompt waits until it has been stable for a moment. Asks once per change.
 */
export function WikiRenamePrompt({ item, title }: { item: ItemRef; title: string }) {
  const router = useRouter();
  const { type, id } = item;
  const baseline = useRef(cleanTitle(title));
  const [ask, setAsk] = useState<Ask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const to = cleanTitle(title);
    const from = baseline.current;
    if (!to || !from || titleKey(to) === titleKey(from) || ask) return;
    const timer = setTimeout(async () => {
      const result = await safeAction(() => countWikiMentions({ type, id }, from));
      // Ask about this change once; a failed count is not worth interrupting for.
      baseline.current = to;
      if (result.ok && result.data.count > 0) setAsk({ from, to, count: result.data.count });
    }, RENAME_CHECK_DELAY);
    return () => clearTimeout(timer);
  }, [title, type, id, ask]);

  const close = () => {
    setAsk(null);
    setError(null);
  };

  const rename = () =>
    startTransition(async () => {
      if (!ask) return;
      const result = await safeAction(() => renameWikiMentions({ type, id }, ask.from, ask.to));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      invalidateWikiTitles();
      router.refresh();
    });

  return (
    <Dialog
      open={ask !== null}
      onClose={() => {
        if (!pending) close();
      }}
      title="다른 본문의 링크도 바꿀까요?"
      description={
        ask
          ? `연결된 ${ask.count}개 항목의 본문에 [[${ask.from}]]가 있습니다. [[${ask.to}]]로 바꾸면 링크가 계속 이어집니다.`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>
            그대로 두기
          </Button>
          <Button variant="primary" onClick={rename} disabled={pending} autoFocus>
            {pending ? "바꾸는 중…" : "바꾸기"}
          </Button>
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
