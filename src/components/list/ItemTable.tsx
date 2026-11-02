import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/Table";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (item: T) => ReactNode;
  /** The column whose content links to the item; the whole row becomes clickable. */
  primary?: boolean;
  className?: string;
  headerClassName?: string;
};

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
            <Th key={c.key} className={c.headerClassName}>
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
                <Td key={c.key} className={c.className}>
                  {c.primary && href ? (
                    // Stretched link: the ::after covers the row so the whole row is clickable.
                    <Link
                      href={href}
                      className="font-medium text-fg after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring"
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
