import { ConnectedItems } from "@/components/links";
import { loadConnected } from "@/components/links/ConnectedItems";
import type { ItemRef } from "@/lib/repo";
import { LocalGraph } from "./LocalGraph";

/**
 * Detail-page row (server component): "연결된 항목" with the local graph beside it (5:5) on
 * wide screens, below it otherwise (docs/design/graph.md 8.1). With nothing connected the
 * section folds to its one header line (＋ 연결 추가) and the graph gets the full width.
 *
 * Usage: `<ConnectedWithGraph item={{ type: "paper", id }} />` in place of `<ConnectedItems/>`.
 */
export async function ConnectedWithGraph({
  item,
  indirect = false,
  hideListedNotes = false,
}: {
  item: ItemRef;
  /** Also list 2-step connections (areas only, see `ConnectedItems`). */
  indirect?: boolean;
  /** See `ConnectedItems`. */
  hideListedNotes?: boolean;
}) {
  const data = await loadConnected(item, { indirect, hideListedNotes });
  const empty = data.connected.length === 0 && data.viaItems.length === 0;
  return (
    <div className={empty ? "flex flex-col gap-3" : "grid grid-cols-1 gap-8 lg:grid-cols-2"}>
      <ConnectedItems item={item} data={data} />
      <LocalGraph node={`${item.type}:${item.id}`} className={empty ? undefined : "self-start"} />
    </div>
  );
}
