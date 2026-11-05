import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonClass } from "./Button";
import { cn } from "./cn";

/** The dashed box around an `EmptyAdd` action (for callers that must keep their own button). */
export const emptyAddBoxClass =
  "flex items-center justify-center rounded-xl border border-dashed border-border px-4 py-5";

/** `compact`: no box, one left-aligned line (`＋ 새 …`) that sits flush with the section title. */
export const emptyAddCompactClass = "-ml-2.5 flex items-center";

/**
 * The only body of an empty section: one add action (`＋ 새 …`), no explanatory copy.
 * Default is a dashed box; `compact` is a single quiet link line.
 * Pass `href` for a link, otherwise the props go to a `<button>`.
 */
export function EmptyAdd(
  props:
    | { href: string; children: ReactNode; className?: string; compact?: boolean }
    | (ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined; compact?: boolean }),
) {
  const boxed = (compact: boolean | undefined, className: string | undefined) =>
    cn(compact ? emptyAddCompactClass : emptyAddBoxClass, className);
  if (props.href !== undefined) {
    const { href, children, className, compact } = props;
    return (
      <div className={boxed(compact, className)}>
        <Link href={href} className={buttonClass("ghost", "sm")}>
          {children}
        </Link>
      </div>
    );
  }
  const { className, compact, type = "button", ...rest } = props;
  delete rest.href;
  return (
    <div className={boxed(compact, className)}>
      <button type={type} className={buttonClass("ghost", "sm")} {...rest} />
    </div>
  );
}
