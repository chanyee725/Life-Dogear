"use client";

import Link from "next/link";
import { useState } from "react";
import {
  createThoughtFromHighlight,
  deleteHighlight,
  updateHighlight,
} from "@/app/_actions/highlights";
import { safeAction } from "@/components/links/safe-action";
import { Button, ConfirmDialog, EmptyState, Textarea, cn } from "@/components/ui";
import { HIGHLIGHT_SWATCH, MAX_HIGHLIGHT_NOTE, type HighlightColor } from "@/lib/highlights";
import type { Highlight } from "@/lib/repo/highlights";
import { ColorSwatches } from "./ColorSwatches";

export type HighlightPanelProps = {
  highlights: Highlight[];
  /** Called after a successful edit with the saved highlight. */
  onUpdated: (highlight: Highlight) => void;
  onRemoved: (id: string) => void;
  /** Click on an item: jump to its page (viewer) or open the reader (detail page). */
  onJump?: (highlight: Highlight) => void;
  /** Alternative to `onJump` for plain links (detail page). */
  hrefFor?: (highlight: Highlight) => string;
  activeId?: string | null;
  className?: string;
};

/** Highlight list: page, colour, text and note; edit note/colour, delete, "생각 만들기". */
export function HighlightPanel({
  highlights,
  onUpdated,
  onRemoved,
  onJump,
  hrefFor,
  activeId,
  className,
}: HighlightPanelProps) {
  if (!highlights.length) {
    return (
      <div className={className}>
        <EmptyState title="하이라이트가 없습니다" />
      </div>
    );
  }
  return (
    <ul className={cn("flex flex-col divide-y divide-border", className)}>
      {highlights.map((h) => (
        <HighlightItem
          key={h.id}
          highlight={h}
          active={h.id === activeId}
          onUpdated={onUpdated}
          onRemoved={onRemoved}
          onJump={onJump}
          href={hrefFor?.(h)}
        />
      ))}
    </ul>
  );
}

function HighlightItem({
  highlight: h,
  active,
  onUpdated,
  onRemoved,
  onJump,
  href,
}: {
  highlight: Highlight;
  active: boolean;
  onUpdated: (h: Highlight) => void;
  onRemoved: (id: string) => void;
  onJump?: (h: Highlight) => void;
  href?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(h.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [thoughtId, setThoughtId] = useState<string | null>(null);

  async function save(patch: { note?: string; color?: HighlightColor }) {
    setBusy(true);
    setError(null);
    const result = await safeAction(() => updateHighlight(h.id, patch));
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    onUpdated(result.data);
    return true;
  }

  async function remove() {
    const result = await safeAction(() => deleteHighlight(h.id));
    if (!result.ok) {
      setError(result.error);
      setConfirming(false);
      return;
    }
    onRemoved(h.id);
  }

  async function makeThought() {
    setBusy(true);
    setError(null);
    const result = await safeAction(() => createThoughtFromHighlight(h.id));
    setBusy(false);
    if (result.ok) setThoughtId(result.data.thoughtId);
    else setError(result.error);
  }

  const summary = (
    <>
      <span className="flex items-center gap-2 text-xs text-faint">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: HIGHLIGHT_SWATCH[h.color] }}
        />
        <span className="tabular-nums">p. {h.page}</span>
      </span>
      <span className="line-clamp-4 text-sm leading-relaxed text-fg">{h.text}</span>
    </>
  );
  const jumpClass =
    "flex w-full flex-col items-start gap-1 rounded-md px-2 py-1.5 text-left hover:bg-hover";

  return (
    <li className={cn("flex flex-col gap-2 py-3", active && "bg-accent-soft/60")}>
      {href ? (
        <Link href={href} className={jumpClass} title={`${h.page}쪽으로 이동`}>
          {summary}
        </Link>
      ) : onJump ? (
        <button
          type="button"
          className={jumpClass}
          onClick={() => onJump(h)}
          title={`${h.page}쪽으로 이동`}
        >
          {summary}
        </button>
      ) : (
        <div className="flex flex-col gap-1 px-2">{summary}</div>
      )}

      <div className="flex flex-col gap-2 px-2">
        {editing ? (
          <>
            <Textarea
              rows={3}
              value={note}
              maxLength={MAX_HIGHLIGHT_NOTE}
              placeholder="메모"
              aria-label={`${h.page}쪽 하이라이트 메모`}
              onChange={(e) => setNote(e.target.value)}
              autoFocus
            />
            <div className="flex items-center justify-between gap-2">
              <ColorSwatches
                value={h.color}
                disabled={busy}
                labelPrefix="색 바꾸기: "
                onPick={(color) => void save({ color })}
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setNote(h.note);
                    setEditing(false);
                  }}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy}
                  onClick={async () => {
                    if (await save({ note })) setEditing(false);
                  }}
                >
                  {busy ? "저장 중…" : "저장"}
                </Button>
              </div>
            </div>
          </>
        ) : h.note ? (
          <p className="whitespace-pre-wrap border-l-2 border-border pl-2 text-[13px] text-muted">
            {h.note}
          </p>
        ) : null}

        {!editing ? (
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              {h.note ? "메모 편집" : "메모 추가"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void makeThought()}>
              생각 만들기
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
              삭제
            </Button>
          </div>
        ) : null}

        {thoughtId ? (
          <p className="text-xs text-muted" aria-live="polite">
            생각을 만들고 이 논문과 연결했어요.{" "}
            <Link href={`/thoughts/${thoughtId}`} className="text-accent hover:underline">
              생각 열기 →
            </Link>
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={remove}
        title="하이라이트를 삭제할까요?"
        description="메모도 함께 삭제됩니다. 이 하이라이트로 만든 생각은 남습니다."
        confirmLabel="삭제"
        danger
      />
    </li>
  );
}
