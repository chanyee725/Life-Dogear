"use client";

import { useState, type ReactNode } from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { Button } from "./Button";
import { cn } from "./cn";
import {
  Dialog as DialogRoot,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./primitives/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./primitives/alert-dialog";

// Entry fades/zooms in via @starting-style (globals.css has no tw-animate-css keyframes).
const enter =
  "transition-[opacity,scale] duration-150 ease-out starting:scale-95 starting:opacity-0 motion-reduce:transition-none";
const panel = "w-[min(28rem,calc(100vw-2rem))] max-w-none sm:max-w-none text-foreground border-border";

function isNamed(title: ReactNode) {
  return title !== null && title !== undefined && title !== false && title !== "";
}

/**
 * Modal built on Radix Dialog (focus trap, Esc, outside click, aria handled by Radix).
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
  // Named by its heading (screen readers, `getByRole("dialog", { name })`); no title, no name.
  const named = isNamed(title);
  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(panel, enter, className)}
        {...(named ? {} : { "aria-labelledby": undefined })}
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <DialogHeader className="gap-1.5 text-left">
          {named ? (
            <DialogTitle className="tracking-tight">{title}</DialogTitle>
          ) : null}
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </DialogRoot>
  );
}

/**
 * Confirmation dialog on Radix AlertDialog (role="alertdialog", focus starts on cancel,
 * no outside-click close). `onConfirm` may be async; the confirm button shows a pending
 * state while it runs. Closing after confirm is left to the caller (via `open`).
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
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <AlertDialogContent
        className={cn(panel, enter)}
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <AlertDialogHeader className="gap-1.5 place-items-start text-left">
          <AlertDialogTitle className="leading-none tracking-tight">{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Radix Cancel (not the shadcn-styled wrapper) so our Button keeps its own look. */}
          <AlertDialogPrimitive.Cancel asChild>
            <Button variant="ghost" disabled={pending}>
              {cancelLabel}
            </Button>
          </AlertDialogPrimitive.Cancel>
          {/* Not AlertDialogAction: that closes immediately, before an async onConfirm settles. */}
          <Button variant={danger ? "danger" : "primary"} onClick={handleConfirm} disabled={pending}>
            {pending ? "처리 중…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
