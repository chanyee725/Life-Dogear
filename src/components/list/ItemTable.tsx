import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/Table";

type ColumnBase<T> = {
  key: string;
  header: ReactNode;
  render: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export type Column<T> = ColumnBase<T> &
  (
    | {
        /** The column whose content links to the item; the whole row becomes clickable. Always visible. */
        primary: true;
        hideBelow?: never;
      }
    | {
        primary?: false;
        /** Hide this secondary column below the breakpoint so narrow windows keep the title readable. */
        hideBelow?: "md" | "lg";
      }
  );

// Literal class strings so Tailwind can see them.
const HIDE_BELOW: Record<"md" | "lg", string> = {
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

const hideClass = (c: { hideBelow?: "md" | "lg" }) =>
  c.hideBelow ? HIDE_BELOW[c.hideBelow] : undefined;

/**
 * Generic item table. Server-compatible: render functions run where the table is rendered,
 * so use it from server pages (or other client components), then hand the result to `ListView`.
 */
export function ItemTable<T>({
  items,
  columns,
  getKey,
  getHref,
  empty,
  className,
}: {
  items: readonly T[];
  columns: readonly Column<T>[];
  getKey: (item: T) => string;
  getHref?: (item: T) => string;
  empty?: ReactNode;
  className?: string;
}) {
  if (items.length === 0) return <>{empty ?? <EmptyState title="항목이 없습니다" />}</>;

  return (
    <Table className={className}>
      <THead>
        <tr>
          {columns.map((c) => (
            <Th key={c.key} className={cn(hideClass(c), c.headerClassName)}>
              {c.header}
            </Th>
          ))}
        </tr>
      </THead>
      <TBody>
        {items.map((item) => {
          const href = getHref?.(item);
          return (
            <Tr key={getKey(item)} className={cn(href && "relative hover:bg-surface")}>
              {columns.map((c) => (
                <Td key={c.key} className={cn(hideClass(c), c.primary && "min-w-56", c.className)}>
                  {c.primary && href ? (
                    // Stretched link: the ::after covers the row so the whole row is clickable.
                    <Link
                      href={href}
                      className="font-medium text-fg after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-accent"
                    >
                      {c.render(item)}
                    </Link>
                  ) : (
                    c.render(item)
                  )}
                </Td>
              ))}
            </Tr>
          );
        })}
      </TBody>
    </Table>
  );
}
