"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { cn } from "./cn";

/**
 * Modal built on the native <dialog> element (focus trap, Esc and backdrop handled by the browser).
 * Controlled: render with `open` and close via `onClose`.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Named by its heading (screen readers, `getByRole("dialog", { name })`); no title, no name.
  const named = title !== null && title !== undefined && title !== false && title !== "";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={named ? titleId : undefined}
      onClose={() => {
        // Fired also when we close it ourselves after `open` became false; only report user closes.
        if (open) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, outside the panel) closes.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        // shadcn DialogContent look; entry fades/zooms in via @starting-style (no keyframes needed).
        "m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-0 text-foreground shadow-lg",
        "transition-[opacity,scale] duration-150 ease-out starting:scale-95 starting:opacity-0 motion-reduce:transition-none",
        "backdrop:bg-black/50 backdrop:transition-opacity backdrop:duration-150 starting:backdrop:opacity-0 motion-reduce:backdrop:transition-none",
        className,
      )}
    >
      {open ? (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1.5">
            {named ? (
              <h2 id={titleId} className="text-lg leading-none font-semibold tracking-tight">
                {title}
              </h2>
            ) : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {children}
          {footer ? <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * Confirmation dialog. `onConfirm` may be async; the confirm button shows a pending state
 * and the dialog closes when it resolves. Errors are left to the caller.
 */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}) {
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onCancel();
      }}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={handleConfirm}
            disabled={pending}
            autoFocus
          >
            {pending ? "처리 중…" : confirmLabel}
          </Button>
        </>
      }
    />
  );
}
