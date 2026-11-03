"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { createQuickThought } from "@/app/_actions/quick-thought";
import { useUnsavedChangesGuard } from "@/components/fields/useUnsavedChangesGuard";
import { safeAction } from "@/components/links/safe-action";
import { Button, cn, controlClass, Kbd, Spinner } from "@/components/ui";
import {
  draftToText,
  EMPTY_DRAFT,
  ESC_CONFIRM_MS,
  hasContent,
  isBareUrl,
  OPEN_CAPTURE_EVENT,
  saveKey,
  TOAST_MS,
  type CaptureDraft,
  type CaptureKind,
} from "./capture";

const DEFAULT_STATUS = "수집함에 저장됩니다.";
const KINDS: { value: CaptureKind; label: string }[] = [
  { value: "thought", label: "생각" },
  { value: "link", label: "링크" },
];

/**
 * Quick capture (docs/design/today.md 6절), mounted once in the root layout. `C` or the
 * Cmd+K command opens it; a thought or a link goes to the inbox as a thought.
 */
export function QuickCapture() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const escAt = useRef(0);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CaptureDraft>(EMPTY_DRAFT);
  const [status, setStatus] = useState<{ text: string; error?: boolean }>({
    text: DEFAULT_STATUS,
  });
  /** Bumped per save so a new toast restarts its timer; 0 = none. */
  const [toast, setToast] = useState(0);
  const hideToast = useCallback(() => setToast(0), []);
  const [pending, startTransition] = useTransition();
  const statusId = useId();

  const dirty = open && hasContent(draft);
  useUnsavedChangesGuard(dirty);

  useEffect(() => {
    const onOpen = () => {
      if (document.querySelector("dialog[open]")) return;
      setDraft(EMPTY_DRAFT); // always opens as 생각
      setStatus({ text: DEFAULT_STATUS });
      escAt.current = 0;
      setOpen(true);
    };
    window.addEventListener(OPEN_CAPTURE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CAPTURE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close(); // native close returns focus to the opener
  }, [open]);

  // Focus the first field when opened or when the kind changes.
  useEffect(() => {
    if (open) firstRef.current?.focus();
  }, [open, draft.kind]);

  /** Esc / backdrop: closes, but text needs a second Esc within 2 s. */
  function requestClose() {
    if (pending) return;
    if (hasContent(draft) && Date.now() - escAt.current > ESC_CONFIRM_MS) {
      escAt.current = Date.now();
      setStatus({ text: "Esc를 한 번 더 누르면 지웁니다." });
      return;
    }
    setOpen(false);
  }

  function setKind(kind: CaptureKind) {
    setDraft((d) => ({ ...d, kind }));
    setStatus({ text: DEFAULT_STATUS });
  }

  function save(mode: "close" | "continue") {
    if (pending) return;
    const result = draftToText(draft);
    if ("error" in result) {
      setStatus({ text: result.error, error: true });
      return;
    }
    startTransition(async () => {
      const saved = await safeAction(() => createQuickThought(result.text));
      if (!saved.ok) {
        setStatus({ text: saved.error, error: true });
        return;
      }
      setDraft((d) => ({ ...EMPTY_DRAFT, kind: d.kind }));
      if (mode === "continue") {
        setStatus({ text: "저장했습니다. 이어서 적으세요." });
        firstRef.current?.focus();
      } else {
        setOpen(false);
        setToast((n) => n + 1);
      }
    });
  }

  function onKeyDown(field: "text" | "url" | "note") {
    return (e: KeyboardEvent<HTMLElement>) => {
      const key = saveKey(
        { ...e, isComposing: e.nativeEvent.isComposing, keyCode: e.keyCode },
        field,
      );
      if (!key) return;
      e.preventDefault();
      save(key);
    };
  }

  function onPasteText(e: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = e.clipboardData.getData("text");
    if (draft.text.trim() || !isBareUrl(pasted)) return;
    e.preventDefault();
    setDraft((d) => ({ ...d, kind: "link", url: pasted.trim() }));
    setStatus({ text: "링크로 바꿨습니다." });
  }

  function onKindKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = draft.kind === "thought" ? "link" : "thought";
    setKind(next);
    requestAnimationFrame(() =>
      e.currentTarget.querySelector<HTMLElement>(`[data-kind="${next}"]`)?.focus(),
    );
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby={`${statusId}-title`}
        onCancel={(e) => {
          e.preventDefault();
          requestClose();
        }}
        onClose={() => {
          if (open) setOpen(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) requestClose();
        }}
        className="mx-auto mt-[15vh] mb-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-border bg-bg p-0 text-fg shadow-overlay backdrop:bg-black/30"
      >
        {open ? (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 id={`${statusId}-title`} className="text-base font-semibold">
                빠른 캡처
              </h2>
              <div
                role="radiogroup"
                aria-label="종류"
                onKeyDown={onKindKey}
                className="inline-flex h-7 items-center rounded-md border border-border p-0.5"
              >
                {KINDS.map((k) => {
                  const on = draft.kind === k.value;
                  return (
                    <button
                      key={k.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      data-kind={k.value}
                      onClick={() => setKind(k.value)}
                      className={cn(
                        "h-6 rounded px-2.5 text-xs transition-colors",
                        on ? "bg-subtle text-fg" : "text-muted hover:text-fg",
                      )}
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {draft.kind === "thought" ? (
              <textarea
                ref={firstRef}
                rows={3}
                aria-label="생각"
                aria-describedby={statusId}
                placeholder="떠오른 생각을 적으세요"
                value={draft.text}
                readOnly={pending}
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                onPaste={onPasteText}
                onKeyDown={onKeyDown("text")}
                className={cn(
                  controlClass,
                  "max-h-[18rem] resize-none py-2 text-[15px] field-sizing-content",
                )}
              />
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  ref={firstRef}
                  type="url"
                  aria-label="링크"
                  aria-describedby={statusId}
                  placeholder="https://…"
                  value={draft.url}
                  readOnly={pending}
                  onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                  onKeyDown={onKeyDown("url")}
                  className={cn(controlClass, "h-9")}
                />
                <input
                  type="text"
                  aria-label="메모"
                  placeholder="왜 저장하나요? (선택)"
                  value={draft.note}
                  readOnly={pending}
                  onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                  onKeyDown={onKeyDown("note")}
                  className={cn(controlClass, "h-9")}
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <p
                id={statusId}
                aria-live="polite"
                className={cn(
                  "min-w-0 flex-1 text-xs",
                  status.error ? "text-danger" : "text-muted",
                )}
              >
                {status.text}
              </p>
              <span className="flex items-center gap-1 text-xs text-muted">
                <Kbd>⌘</Kbd>
                <Kbd>Enter</Kbd> 저장
              </span>
              <Button size="sm" onClick={() => save("close")} disabled={pending}>
                {pending ? <Spinner /> : null}
                저장
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
      {toast ? <SavedToast key={toast} onDone={hideToast} /> : null}
    </>
  );
}

/** "수집함에 저장했습니다. 보기" for 3 s; paused while hovered or focused (6.4). */
function SavedToast({ onDone }: { onDone: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(timer);
  }, [paused, onDone]);
  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="fixed right-4 bottom-4 z-50 rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-fg shadow-overlay"
    >
      수집함에 저장했습니다.{" "}
      <Link href="/inbox" onClick={onDone} className="underline">
        보기
      </Link>
    </div>
  );
}
