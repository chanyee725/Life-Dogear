"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import type { ActionResult } from "@/app/_actions/result";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

export type ItemFormAction = (form: FormData) => Promise<ActionResult<{ id: string }>>;

/**
 * Create/edit form for an item, with a top bar (back link, status, extra actions, 저장).
 * - create: on success navigates to `${basePath}/${id}`
 * - edit: on success shows "저장됨" and refreshes server data
 * Cmd/Ctrl+S submits. Errors from the action are shown inline.
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
    // `new FormData(form)` fires the `formdata` event the editor uses to write its exact value.
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (mode === "create") {
        router.push(`${basePath}/${result.data.id}`);
      } else {
        setSavedAt(new Date());
        router.refresh();
      }
    });
  }

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
          <span aria-live="polite" className="text-xs text-faint">
            {pending ? "저장 중…" : savedAt ? `저장됨 · ${formatTime(savedAt)}` : null}
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
