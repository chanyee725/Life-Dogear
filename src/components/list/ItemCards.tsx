import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ItemGroup } from "./groups";

/** Responsive card grid. Server-compatible like `ItemTable`; `groups` adds a heading per group. */
export function ItemCards<T>({
  items,
  groups,
  getKey,
  getHref,
  renderCard,
  empty,
  className,
}: {
  items: readonly T[];
  groups?: readonly ItemGroup<T>[];
  getKey: (item: T) => string;
  getHref?: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
}) {
  if (items.length === 0) return <>{empty ?? <EmptyState title="항목이 없습니다" />}</>;

  const grid = (list: readonly T[]) => (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {list.map((item) => (
        <Card key={getKey(item)} href={getHref?.(item)} className="flex flex-col gap-2">
          {renderCard(item)}
        </Card>
      ))}
    </div>
  );

  if (!groups) return grid(items);
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.key} aria-label={`${group.label} ${group.items.length}개`}>
          <h2 className="mb-2 text-xs font-medium text-fg">
            {group.label}
            <span className="ml-1.5 font-normal text-muted tabular-nums">{group.items.length}</span>
          </h2>
          {grid(group.items)}
        </section>
      ))}
    </div>
  );
}
