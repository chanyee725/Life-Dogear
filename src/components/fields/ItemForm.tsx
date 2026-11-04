"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import type { ActionResult } from "@/app/_actions/result";
import { safeAction } from "@/components/links/safe-action";
import { Button, cn, DetailHeader, QuietButton } from "@/components/ui";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import {
  AUTOSAVE_READ_ATTR,
  baselineFromRendered,
  type RenderedField,
  EDITOR_READY_EVENT,
  formToPatch,
  patchToFormData,
  type FormPatch,
} from "./form-patch";
import { SaveStatus } from "./ItemDetail";
import { createHeldBaseline, createSaveQueue, type SaveState } from "./save-queue";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

export type ItemFormAction = (form: FormData) => Promise<ActionResult<{ id: string }>>;

/** Pause after the last edit before autosaving (matches the paper editor). */
export const AUTOSAVE_DELAY = 1000;

type Props = {
  action: ItemFormAction;
  /** Section path, e.g. "/projects". */
  basePath: string;
  /** Back link text, e.g. "연구". */
  backLabel: string;
  /** Extra quiet controls in the header (보관, 삭제). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Item form with the shared detail header.
 * - `create`: explicit 저장 (button or Cmd/Ctrl+S), then navigates to `${basePath}/${id}`.
 * - `edit`: autosaves about a second after edits stop; Cmd/Ctrl+S or 저장 saves now.
 *   Only fields that differ from the last saved values are sent; failed fields are kept
 *   and retried. Unsaved edits show "저장 안 됨" and guard leaving the page.
 * Fields signal edits with bubbling `input`/`change` events (the editor and TagInput
 * dispatch `input` for changes that don't come from typing).
 */
export function ItemForm({ mode, ...props }: Props & { mode: "create" | "edit" }) {
  return mode === "create" ? <CreateForm {...props} /> : <AutosaveForm {...props} />;
}

function useSaveShortcut(onSave: () => void) {
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSaveRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/** Calls `onEdit` for every bubbling input/change event inside the form. */
function useFormEdits(formRef: React.RefObject<HTMLFormElement | null>, onEdit: () => void) {
  const onEditRef = useRef(onEdit);
  useEffect(() => {
    onEditRef.current = onEdit;
  });
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const handler = () => onEditRef.current();
    form.addEventListener("input", handler);
    form.addEventListener("change", handler);
    return () => {
      form.removeEventListener("input", handler);
      form.removeEventListener("change", handler);
    };
  }, [formRef]);
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="rounded-lg bg-tone-red-bg px-3 py-2 text-sm text-tone-red-fg">
      {error}
    </p>
  ) : null;
}

function CreateForm({ action, basePath, backLabel, actions, children, className }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useFormEdits(formRef, () => setDirty(true));
  useUnsavedChangesGuard(dirty);
  useSaveShortcut(() => formRef.current?.requestSubmit());

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    // `new FormData(form)` fires the `formdata` event the editor and TagInput use to
    // write their exact values (unsaved tag draft included).
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await safeAction(() => action(data));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDirty(false);
      router.push(`${basePath}/${result.data.id}`);
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className={cn("flex flex-col gap-6", className)}>
      <DetailHeader
        backHref={basePath}
        backLabel={backLabel}
        status={<SaveStatus state={pending ? "saving" : dirty ? "pending" : "idle"} />}
        actions={
          <>
            {actions}
            <Button type="submit" variant="primary" size="sm" disabled={pending} className="ml-1">
              저장
            </Button>
          </>
        }
      />
      <ErrorLine error={error} />
      {children}
    </form>
  );
}

/** Reads the form as a patch. Autosave reads skip submit-only work (TagInput drafts). */
function readForm(form: HTMLFormElement, autosave: boolean): FormPatch {
  if (autosave) form.setAttribute(AUTOSAVE_READ_ATTR, "");
  try {
    return formToPatch(new FormData(form));
  } finally {
    form.removeAttribute(AUTOSAVE_READ_ATTR);
  }
}

/** Text inputs and textareas with their rendered (`defaultValue`) and current value. */
function renderedFields(form: HTMLFormElement): RenderedField[] {
  return Array.from(form.elements).flatMap((el): RenderedField[] => {
    if (el instanceof HTMLTextAreaElement) {
      return [{ name: el.name, value: el.value, defaultValue: el.defaultValue }];
    }
    if (el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(el.type)) {
      return [{ name: el.name, value: el.value, defaultValue: el.defaultValue, singleLine: true }];
    }
    return [];
  });
}

/**
 * Input types compared with their `defaultValue`. Other types (url, email, date…) get a
 * value the browser sanitises differently from the untouched `defaultValue`, so merely
 * opening the page would look like an edit.
 */
const TEXT_INPUT_TYPES = new Set(["text", "search"]);

function AutosaveForm({ action, basePath, backLabel, actions, children, className }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedOnce, setSavedOnce] = useState(false);
  /** Shown for a moment after an explicit 저장 that left nothing unsaved. */
  const [confirmed, setConfirmed] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedRef = useRef(false);
  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );
  const [titleMissing, setTitleMissing] = useState(false);
  /** Edited since the form was last read into the queue. */
  const [unread, setUnread] = useState(false);
  const unreadRef = useRef(false);
  /** The only unread edits are text typed before hydration (no edits since). */
  const preHydrationOnlyRef = useRef(false);
  useEffect(() => {
    unreadRef.current = unread;
  }, [unread]);

  const [queue] = useState(() =>
    createSaveQueue<FormPatch>(
      (patch) => safeAction(() => action(patchToFormData(patch))),
      (next, message) => {
        setState(next);
        failedRef.current = next === "error";
        if (next !== "saved" && next !== "idle") setConfirmed(false);
        if (next === "error") setError(message);
        if (next === "saved") {
          setError(null);
          setSavedOnce(true);
        }
      },
    ),
  );

  /** The editor's normalised body, held while a save refuses the ready re-read. */
  const [readyBaseline] = useState(() => createHeldBaseline(queue, "body"));

  function readIntoQueue(autosave: boolean, form: HTMLFormElement | null = formRef.current) {
    if (!form) return;
    const patch = readForm(form, autosave);
    // A blank title can't be saved; keep the other fields going and say why.
    const blank = typeof patch.title === "string" && !patch.title.trim();
    setTitleMissing(blank);
    if (blank) delete patch.title;
    unreadRef.current = false;
    preHydrationOnlyRef.current = false;
    setUnread(false);
    queue.add(patch);
    // The user's own body is queued: a held editor-ready body is older than it.
    if ("body" in queue.pending()) readyBaseline.drop();
    void flushQueue();
  }

  async function flushQueue() {
    await queue.flush();
    readyBaseline.settle();
  }

  // Not flushed by the debounce hook on unmount: React clears `formRef` before that
  // cleanup runs. The effect below keeps its own reference to the form instead.
  const autosave = useDebouncedCallback(() => readIntoQueue(true), AUTOSAVE_DELAY);

  // Baseline = what the form shows on load (the server values), read once after mount,
  // so opening the page never saves. Text typed before hydration is already in the DOM
  // by now: those fields keep their rendered value in the baseline and get saved.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const { baseline, edited } = baselineFromRendered(readForm(form, true), renderedFields(form));
    queue.resetBaseline(baseline);
    if (edited) {
      unreadRef.current = true;
      preHydrationOnlyRef.current = true;
      setUnread(true);
      autosave();
    }
    // The editor mounts a bit later and may normalise the body; re-read the baseline
    // then (only while nothing is unsaved; while a save runs, the body is held until it
    // ends). Text typed before hydration is still unread but not yet in the queue: re-read
    // around it, so the re-serialised body doesn't go out with the title and overwrite a
    // newer one.
    const onEditorReady = () => {
      let baseline: FormPatch;
      if (preHydrationOnlyRef.current) {
        baseline = baselineFromRendered(readForm(form, true), renderedFields(form)).baseline;
      } else if (!unreadRef.current) {
        baseline = readForm(form, true);
      } else {
        return;
      }
      readyBaseline.offer(baseline);
    };
    form.addEventListener(EDITOR_READY_EVENT, onEditorReady);
    return () => form.removeEventListener(EDITOR_READY_EVENT, onEditorReady);
    // `queue`, `readyBaseline` and `autosave` are stable: this runs once per form.
  }, [queue, readyBaseline, autosave]);

  // Leaving the page (link, back button) within the debounce window must not lose the
  // last edits: read the still-existing form element and send what changed.
  const readIntoQueueRef = useRef(readIntoQueue);
  useEffect(() => {
    readIntoQueueRef.current = readIntoQueue;
  });
  useEffect(() => {
    const form = formRef.current;
    return () => {
      if (unreadRef.current) readIntoQueueRef.current(true, form);
    };
  }, []);

  async function saveNow() {
    autosave.cancel();
    readIntoQueue(false);
    await flushQueue();
    // Nothing left to send and no failure: answer the click, even if autosave had
    // already stored everything (then there was nothing new to send).
    if (queue.dirty() || failedRef.current || unreadRef.current) return;
    setSavedOnce(true);
    setConfirmed(true);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmed(false), 2500);
  }

  useFormEdits(formRef, () => {
    unreadRef.current = true;
    preHydrationOnlyRef.current = false;
    setUnread(true);
    setConfirmed(false);
    autosave();
  });
  useSaveShortcut(() => void saveNow());

  const dirty = unread || queue.dirty() || state === "error";
  useUnsavedChangesGuard(dirty);
  const shown: SaveState = unread && state !== "saving" ? "pending" : state;

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        void saveNow();
      }}
      className={cn("flex flex-col gap-6", className)}
    >
      <DetailHeader
        backHref={basePath}
        backLabel={backLabel}
        status={<SaveStatus state={shown} savedOnce={savedOnce} confirmed={confirmed} />}
        actions={
          <>
            {actions}
            <QuietButton type="submit">저장</QuietButton>
          </>
        }
      />
      <ErrorLine
        error={titleMissing ? "제목을 입력하세요. 비어 있는 동안 제목은 저장되지 않습니다." : null}
      />
      <ErrorLine error={error} />
      {children}
    </form>
  );
}
