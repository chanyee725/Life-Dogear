import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonClass } from "./Button";
import { cn } from "./cn";

const boxClass =
  "flex items-center justify-center rounded-lg border border-dashed border-border px-4 py-5";

/**
 * The only body of an empty section: a dashed box holding one add action (`＋ 새 …`),
 * no explanatory copy. Pass `href` for a link, otherwise the props go to a `<button>`.
 */
export function EmptyAdd(
  props:
    | { href: string; children: ReactNode; className?: string }
    | (ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }),
) {
  if (props.href !== undefined) {
    const { href, children, className } = props;
    return (
      <div className={cn(boxClass, className)}>
        <Link href={href} className={buttonClass("ghost", "sm")}>
          {children}
        </Link>
      </div>
    );
  }
  const { className, type = "button", ...rest } = props;
  delete rest.href;
  return (
    <div className={cn(boxClass, className)}>
      <button type={type} className={buttonClass("ghost", "sm")} {...rest} />
    </div>
  );
}
