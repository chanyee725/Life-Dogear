import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "icon";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  // A <Kbd> hint inside a primary button switches to an on-accent style so it stays legible.
  primary:
    "bg-accent text-accent-fg hover:bg-accent-hover [&_kbd]:border-transparent [&_kbd]:bg-accent-fg/15 [&_kbd]:text-accent-fg",
  secondary: "border border-border bg-bg text-fg hover:bg-hover",
  ghost: "text-muted hover:bg-hover hover:text-fg",
  danger: "bg-danger text-white hover:bg-danger-hover dark:text-bg",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[13px]",
  md: "h-9 px-3.5 text-sm",
  icon: "h-8 w-8 text-sm",
};

/** Class string for button-looking elements (e.g. a Next `<Link>`). */
export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(base, variants[variant], sizes[size], className);
}

export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/** A Next `<Link>` that looks like a `Button`. */
export function LinkButton({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/**
 * "새 …" link. In a page header (default) it is the primary md button bound to the N
 * shortcut; `size="sm"` is the in-empty-state form (no shortcut, so N stays unique).
 */
export function NewItemButton({
  size = "md",
  shortcut = size === "md",
  variant = "primary",
  ...props
}: LinkButtonProps & { shortcut?: boolean }) {
  return (
    <LinkButton
      variant={variant}
      size={size}
      aria-keyshortcuts={shortcut ? "N" : undefined}
      title={shortcut ? "단축키 N" : undefined}
      {...props}
    />
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
