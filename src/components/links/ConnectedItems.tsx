import Link from "next/link";
import { itemPath } from "@/app/_actions/parse";
import { Badge, ListRow, RowList, Section } from "@/components/ui";
import { ITEM_TYPE } from "@/lib/enums";
import { areas, links, type ItemRef } from "@/lib/repo";
import { refKey } from "@/lib/repo/items";
import { LinkPicker } from "./LinkPicker";
import { UnlinkButton } from "./UnlinkButton";

/**
 * "연결된 항목" section for a detail page (server component).
 * Shows links in both directions, newest first, with add and remove controls.
 *
 * With `indirect` (areas only), also lists up to 6 items two steps away — linked to the
 * area's projects, goals or linked items — each tagged with the name of the item it came through (small chip).
 * Those rows have no unlink button.
 *
 * Usage: `<ConnectedItems item={{ type: "paper", id }} />`
 */
export async function ConnectedItems({
  item,
  title = "연결된 항목",
  className,
  indirect = false,
}: {
  item: ItemRef;
  title?: string;
  className?: string;
  indirect?: boolean;
}) {
  const [connected, viaItems] = await Promise.all([
    links.listConnected(item),
    indirect && item.type === "area" ? areas.listIndirect(item.id) : Promise.resolve([]),
  ]);

  return (
    <div role="region" aria-label={title} className={className}>
      <Section
        title={
          <>
            {title}
            {connected.length ? (
              <span aria-hidden className="ml-1.5 font-normal text-muted">
                {connected.length}
              </span>
            ) : null}
          </>
        }
        action={<LinkPicker item={item} connectedKeys={connected.map((c) => refKey(c.ref))} />}
      >
        {connected.length === 0 && viaItems.length === 0 ? null : (
          <RowList>
            {connected.map((c) => (
              <ListRow key={refKey(c.ref)} className="group transition-colors hover:bg-hover">
                <Badge tone={ITEM_TYPE.tone(c.type)}>{ITEM_TYPE.label(c.type)}</Badge>
                <Link
                  href={itemPath(c.ref)}
                  className="min-w-0 flex-1 truncate text-sm text-fg hover:underline"
                >
                  {c.title}
                </Link>
                {c.archived ? <Badge tone="gray">보관됨</Badge> : null}
                <UnlinkButton item={item} other={c.ref} otherTitle={c.title} />
              </ListRow>
            ))}
            {viaItems.map((c) => (
              <ListRow
                key={`via-${refKey(c.ref)}`}
                data-indirect=""
                className="transition-colors hover:bg-hover"
              >
                <Badge tone={ITEM_TYPE.tone(c.ref.type)}>{ITEM_TYPE.label(c.ref.type)}</Badge>
                <Link
                  href={itemPath(c.ref)}
                  className="min-w-0 flex-1 truncate text-sm text-fg hover:underline"
                >
                  {c.title}
                </Link>
                <span
                  title={`${c.via.title}에서 이어짐`}
                  className="max-w-[40%] shrink-0 truncate rounded-full bg-subtle px-2 py-0.5 text-xs text-muted sm:max-w-48"
                >
                  {c.via.title}
                </span>
              </ListRow>
            ))}
          </RowList>
        )}
      </Section>
    </div>
  );
}
