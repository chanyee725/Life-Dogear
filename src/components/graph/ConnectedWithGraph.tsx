import { ConnectedItems } from "@/components/links";
import type { ItemRef } from "@/lib/repo";
import { LocalGraph } from "./LocalGraph";

/**
 * Detail-page row (server component): "연결된 항목" with the local graph to its right on
 * wide screens, below it otherwise (docs/design/graph.md 8.1).
 *
 * Usage: `<ConnectedWithGraph item={{ type: "paper", id }} />` in place of `<ConnectedItems/>`.
 */
export function ConnectedWithGraph({
  item,
  indirect = false,
}: {
  item: ItemRef;
  /** Also list 2-step connections (areas only, see `ConnectedItems`). */
  indirect?: boolean;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <ConnectedItems item={item} indirect={indirect} />
      <LocalGraph node={`${item.type}:${item.id}`} className="self-start" />
    </div>
  );
}
