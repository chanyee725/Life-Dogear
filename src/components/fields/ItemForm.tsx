"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import type { ActionResult } from "@/app/_actions/result";
import { safeAction } from "@/components/links/safe-action";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

export type ItemFormAction = (form: FormData) => Promise<ActionResult<{ id: string }>>;

/**
 * Create/edit form for an item, with a top bar (back link, status, extra actions, 저장).
 * - create: on success navigates to `${basePath}/${id}`
 * - edit: on success shows "저장됨" and refreshes server data
 * Cmd/Ctrl+S submits. Errors (including network failures) are shown inline.
 * Unsaved edits show "저장 안 됨"; leaving the page or following an in-app link asks first.
 * Fields signal edits with bubbling `input`/`change` events (the editor and TagInput
 * dispatch `input` for changes that don't come from typing).
 */
export function ItemForm({
  mode,
  action,
  basePath,
  backLabel,
  actions,
  children,
  className,
}: {
  mode: "create" | "edit";
  action: ItemFormAction;
  /** Section path, e.g. "/projects". */
  basePath: string;
  /** Back link text, e.g. "연구". */
  backLabel: string;
  /** Extra controls shown next to 저장 (e.g. a delete button). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  // Bumped on every edit, so a save only clears `dirty` if nothing changed meanwhile.
  const editVersion = useRef(0);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onEdit = () => {
      editVersion.current += 1;
      setDirty(true);
    };
    form.addEventListener("input", onEdit);
    form.addEventListener("change", onEdit);
    return () => {
      form.removeEventListener("input", onEdit);
      form.removeEventListener("change", onEdit);
    };
  }, []);

  useUnsavedChangesGuard(dirty);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    // `new FormData(form)` fires the `formdata` event the editor and TagInput use to
    // write their exact values (unsaved tag draft included).
    const data = new FormData(event.currentTarget);
    const submittedVersion = editVersion.current;
    setError(null);
    startTransition(async () => {
      const result = await safeAction(() => action(data));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (editVersion.current === submittedVersion) setDirty(false);
      if (mode === "create") {
        router.push(`${basePath}/${result.data.id}`);
      } else {
        setSavedAt(new Date());
        router.refresh();
      }
    });
  }

  const status = pending
    ? "저장 중…"
    : dirty
      ? "저장 안 됨"
      : savedAt
        ? `저장됨 · ${formatTime(savedAt)}`
        : null;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}

      className={cn("flex flex-col gap-6", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <Link href={basePath} className="text-[13px] text-muted hover:text-fg">
          ← {backLabel}
        </Link>
        <div className="flex items-center gap-2">
          <span
            aria-live="polite"
            className={cn("text-xs", dirty && !pending ? "text-tone-amber-fg" : "text-faint")}
          >
            {status}
          </span>
          {actions}
          <Button type="submit" variant="primary" disabled={pending}>
            저장
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-tone-red-bg px-3 py-2 text-sm text-tone-red-fg">
          {error}
        </p>
      ) : null}
      {children}
    </form>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

/** Large borderless title input used at the top of item forms (accessible name "제목"). */
export function TitleInput({
  defaultValue,
  placeholder = "제목 없음",
}: {
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <input
      name="title"
      aria-label="제목"
      required
      maxLength={300}
      defaultValue={defaultValue}
      placeholder={placeholder}
      autoComplete="off"
      className="w-full bg-transparent text-2xl font-semibold tracking-tight text-fg placeholder:text-faint focus:outline-none"
    />
  );
}
