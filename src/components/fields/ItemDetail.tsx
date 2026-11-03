import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import type { SaveState } from "./save-queue";

/**
 * Shared detail-page layout (S1, modelled on the project page):
 *
 *   <DetailHeader backHref="/papers" backLabel="논문" status={<SaveStatus …/>} actions={…} />
 *   <TitleInput … />                       // large title, accessible name "제목"
 *   <Properties><Property label="…">…</Property></Properties>
 *   <DetailBody>{editor}</DetailBody>      // thin divider above the body
 *   …then <ConnectedItems/> below the form.
 *
 * Archive/delete live in `actions` as quiet text buttons (`QuietButton`, `DeleteItemButton`).
 */
export function DetailHeader({
  backHref,
  backLabel,
  status,
  actions,
  className,
}: {
  backHref: string;
  backLabel: string;
  /** Usually `<SaveStatus/>`. */
  status?: ReactNode;
  /** Quiet buttons (보관, 삭제, 저장). */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1", className)}>
      <Link
        href={backHref}
        className="shrink-0 text-[13px] whitespace-nowrap text-muted hover:text-fg"
      >
        ← {backLabel}
      </Link>
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
        {status ? <div className="mr-2 whitespace-nowrap">{status}</div> : null}
        {actions}
      </div>
    </div>
  );
}

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  pending: "저장 안 됨",
  saving: "저장 중…",
  saved: "저장됨",
  error: "저장 실패",
};

/** Save state text for the header. `idle` after a save still reads "저장됨". */
export function SaveStatus({
  state,
  savedOnce = false,
}: {
  state: SaveState;
  savedOnce?: boolean;
}) {
  const label = state === "idle" && savedOnce ? SAVE_LABEL.saved : SAVE_LABEL[state];
  return (
    <span
      aria-live="polite"
      data-state={state}
      className={cn(
        "text-xs",
        state === "pending"
          ? "text-tone-amber-fg"
          : state === "error"
            ? "text-danger"
            : "text-muted",
      )}
    >
      {label}
    </span>
  );
}

/** Low-emphasis text button for header actions (보관, 삭제, 저장). */
export function QuietButton({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "h-7 shrink-0 rounded-md px-2 text-[13px] whitespace-nowrap text-muted transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

/** Large borderless title input (accessible name "제목"). Works controlled or uncontrolled. */
export function TitleInput({
  placeholder = "제목 없음",
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      name="title"
      aria-label="제목"
      required
      maxLength={300}
      autoComplete="off"
      placeholder={placeholder}
      className={cn(
        "w-full bg-transparent text-2xl font-semibold tracking-tight text-fg placeholder:text-faint focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

/** Body area under the properties, separated by a thin rule. */
export function DetailBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border-t border-border pt-6", className)}>{children}</div>;
}
