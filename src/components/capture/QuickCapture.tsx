"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { createQuickThought } from "@/app/_actions/quick-thought";
import { createNote } from "@/app/notes/actions";
import { useUnsavedChangesGuard } from "@/components/fields/useUnsavedChangesGuard";
import { safeAction } from "@/components/links/safe-action";
import { useModKey } from "@/components/shell/mod-key";
import { Button, cn, controlClass, Kbd, Spinner } from "@/components/ui";
import {
  autosizeHeight,
  draftToSave,
  EMPTY_DRAFT,
  ESC_CONFIRM_MS,
  hasContent,
  isBareUrl,
  nextKind,
  OPEN_CAPTURE_EVENT,
  saveKey,
  TOAST_MS,
  type CaptureDraft,
  type CaptureField,
  type CaptureSave,
  THOUGHT_MIN_ROWS,
  type CaptureKind,
} from "./capture";

const DEFAULT_STATUS = "수집함에 저장됩니다.";
const NOTE_STATUS = "새 노트로 저장됩니다.";
const statusFor = (kind: CaptureKind) => (kind === "note" ? NOTE_STATUS : DEFAULT_STATUS);
const KINDS: { value: CaptureKind; label: string }[] = [
  { value: "thought", label: "생각" },
  { value: "link", label: "링크" },
  { value: "note", label: "노트" },
];

/** What the toast after a save points to. */
type Saved = { n: number; note?: string };

async function saveCapture(item: CaptureSave) {
  if (item.kind === "thought") return createQuickThought(item.text);
  const form = new FormData();
  form.set("title", item.title);
  form.set("body", item.body);
  return createNote(form);
}

/**
 * Quick capture (docs/design/today.md 6절), mounted once in the root layout. `C` or the
 * Cmd+K command opens it; a thought or a link goes to the inbox as a thought, a 노트
 * (title + body) becomes a new note.
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
  const [toast, setToast] = useState<Saved>({ n: 0 });
  const hideToast = useCallback(() => setToast({ n: 0 }), []);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // Plain state, not useTransition: a transition stays pending through the server action's
  // revalidation refresh, which would lock the fields for ⇧⌘Enter "keep writing".
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const statusId = useId();
  const modKey = useModKey();

  // 생각 box: 3 lines, growing with the text up to 12, then it scrolls. Measured in JS:
  // CSS `field-sizing` ignores `rows` and is not available everywhere.
  useLayoutEffect(() => {
    const el = firstRef.current;
    if (!open || draft.kind !== "thought" || !el) return;
    const style = getComputedStyle(el);
    const px = (v: string) => Number.parseFloat(v) || 0;
    const lineHeight = px(style.lineHeight) || px(style.fontSize) * 1.5;
    const padding = px(style.paddingTop) + px(style.paddingBottom);
    const chrome = padding + px(style.borderTopWidth) + px(style.borderBottomWidth);
    el.style.height = "0px";
    const { height, scroll } = autosizeHeight(el.scrollHeight - padding, lineHeight, chrome);
    el.style.height = `${height}px`;
    el.style.overflowY = scroll ? "auto" : "hidden";
  }, [open, draft.kind, draft.text]);

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
    setStatus({ text: statusFor(kind) });
  }

  async function save(mode: "close" | "continue") {
    if (saving.current) return;
    const result = draftToSave(draft);
    if ("error" in result) {
      setStatus({ text: result.error, error: true });
      return;
    }
    saving.current = true;
    setPending(true);
    try {
      const saved = await safeAction(() => saveCapture(result));
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
        setToast((t) => ({
          n: t.n + 1,
          note: result.kind === "note" ? saved.data.id : undefined,
        }));
      }
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  function onKeyDown(field: CaptureField) {
    return (e: KeyboardEvent<HTMLElement>) => {
      const composing = e.nativeEvent.isComposing || e.keyCode === 229;
      const key = saveKey({ ...e, isComposing: composing, keyCode: e.keyCode }, field);
      // Enter in the note title moves on to the body.
      if (!key && field === "title" && e.key === "Enter" && !composing && !e.shiftKey) {
        e.preventDefault();
        bodyRef.current?.focus();
        return;
      }
      if (!key) return;
      e.preventDefault();
      void save(key);
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
    const next = nextKind(draft.kind, e.key === "ArrowRight" ? 1 : -1);
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
                rows={THOUGHT_MIN_ROWS}
                aria-label="생각"
                aria-describedby={statusId}
                placeholder="떠오른 생각을 적으세요"
                value={draft.text}
                readOnly={pending}
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                onPaste={onPasteText}
                onKeyDown={onKeyDown("text")}
                className={cn(controlClass, "resize-none py-2 text-[15px] leading-normal")}
              />
            ) : draft.kind === "note" ? (
              <div className="flex flex-col gap-2">
                <input
                  ref={firstRef}
                  type="text"
                  aria-label="노트 제목"
                  aria-describedby={statusId}
                  placeholder="제목"
                  value={draft.title}
                  readOnly={pending}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  onKeyDown={onKeyDown("title")}
                  className={cn(controlClass, "h-9")}
                />
                <textarea
                  ref={bodyRef}
                  rows={5}
                  aria-label="노트 본문"
                  placeholder="정리할 내용 (선택)"
                  value={draft.body}
                  readOnly={pending}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  onKeyDown={onKeyDown("body")}
                  className={cn(controlClass, "resize-y py-2 text-[15px] leading-normal")}
                />
              </div>
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
                <Kbd>{modKey}</Kbd>
                <Kbd>Enter</Kbd> 저장
              </span>
              <Button size="sm" onClick={() => void save("close")} disabled={pending}>
                {pending ? <Spinner /> : null}
                저장
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
      {toast.n ? <SavedToast key={toast.n} note={toast.note} onDone={hideToast} /> : null}
    </>
  );
}

/**
 * "수집함에 저장했습니다. 보기" (or "노트를 만들었습니다. 열기" for a note) for 3 s;
 * paused while hovered or focused (6.4).
 */
function SavedToast({ note, onDone }: { note?: string; onDone: () => void }) {
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
      {note ? "노트를 만들었습니다." : "수집함에 저장했습니다."}{" "}
      <Link href={note ? `/notes/${note}` : "/inbox"} onClick={onDone} className="underline">
        {note ? "열기" : "보기"}
      </Link>
    </div>
  );
}
