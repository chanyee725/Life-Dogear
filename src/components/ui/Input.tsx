import type {
  ComponentProps,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

/**
 * shadcn/ui text control: input border, faint shadow, opaque accent border + 3px
 * --ring halo on focus, destructive border/halo when `aria-invalid`.
 */
export const controlClass =
  "w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs placeholder:text-faint transition-[color,border-color,box-shadow] hover:border-border-strong focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50";

// Select keeps its previous look until the Select pass restyles it.
const selectControlClass =
  "w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg placeholder:text-faint transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

export type ControlSize = "sm" | "md";
const controlSize: Record<ControlSize, string> = { sm: "h-8 text-[13px]", md: "h-9" };

export type InputProps = Omit<ComponentProps<"input">, "size"> & {
  size?: ControlSize;
};

/** Text input; `size="sm"` (h-8, 13px) for toolbars and panels. */
export function Input({ className, size = "md", ...props }: InputProps) {
  return <input className={cn(controlClass, controlSize[size], className)} {...props} />;
}

export function Textarea({
  className,
  rows = 3,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={cn(controlClass, "py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  size = "md",
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: ControlSize }) {
  return (
    <select
      className={cn(selectControlClass, "rb-select cursor-pointer pr-8", controlSize[size], className)}
      {...props}
    >
      {children}
    </select>
  );
}

/** Label + control + optional hint/error, stacked. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
