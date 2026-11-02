import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";

/** Responsive card grid. Server-compatible like `ItemTable`. */
export function ItemCards<T>({
  items,
  getKey,
  getHref,
  renderCard,
  empty,
  className,
}: {
  items: readonly T[];
  getKey: (item: T) => string;
  getHref?: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
}) {
  if (items.length === 0) return <>{empty ?? <EmptyState title="항목이 없습니다" />}</>;

  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item) => (
        <Card key={getKey(item)} href={getHref?.(item)} className="flex flex-col gap-2">
          {renderCard(item)}
        </Card>
      ))}
    </div>
  );
}
