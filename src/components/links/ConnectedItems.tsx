import Link from "next/link";
import { itemPath } from "@/app/_actions/parse";
import { Badge, ListRow, RowList, Section } from "@/components/ui";
import { ITEM_TYPE } from "@/lib/enums";
import { links, type ItemRef } from "@/lib/repo";
import { refKey } from "@/lib/repo/items";
import { LinkPicker } from "./LinkPicker";
import { UnlinkButton } from "./UnlinkButton";

/**
 * "연결된 항목" section for a detail page (server component).
 * Shows links in both directions, newest first, with add and remove controls.
 *
 * Usage: `<ConnectedItems item={{ type: "paper", id }} />`
 */
export async function ConnectedItems({
  item,
  title = "연결된 항목",
  className,
}: {
  item: ItemRef;
  title?: string;
  className?: string;
}) {
  const connected = await links.listConnected(item);

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
        {connected.length === 0 ? null : (
          <RowList>
            {connected.map((c) => (
              <ListRow key={refKey(c.ref)} className="group">
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
          </RowList>
        )}
      </Section>
    </div>
  );
}
