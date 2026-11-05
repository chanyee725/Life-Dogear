import Link from "next/link";
import { itemPath } from "@/app/_actions/parse";
import { Badge, ListRow, RowList, Section } from "@/components/ui";
import { ITEM_TYPE } from "@/lib/enums";
import { areas, links, notes, type ItemRef } from "@/lib/repo";
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
type ConnectedOptions = {
  indirect?: boolean;
  /** Drop notes already listed in the page's 노트 section (project, goal, area pages). */
  hideListedNotes?: boolean;
};

/** What `ConnectedItems` lists; load once with this when the caller also needs the count. */
export async function loadConnected(
  item: ItemRef,
  { indirect = false, hideListedNotes = false }: ConnectedOptions = {},
) {
  const [allConnected, viaItems, listedNotes] = await Promise.all([
    links.listConnected(item),
    indirect && item.type === "area" ? areas.listIndirect(item.id) : Promise.resolve([]),
    hideListedNotes && (item.type === "project" || item.type === "goal" || item.type === "area")
      ? notes.listForItem({ type: item.type, id: item.id })
      : Promise.resolve([]),
  ]);
  const listed = new Set(listedNotes.map((n) => n.id));
  const connected = allConnected.filter((c) => !(c.ref.type === "note" && listed.has(c.ref.id)));
  return { connected, viaItems };
}

export type ConnectedData = Awaited<ReturnType<typeof loadConnected>>;

export async function ConnectedItems({
  item,
  title = "연결된 항목",
  className,
  indirect = false,
  hideListedNotes = false,
  data,
}: ConnectedOptions & {
  item: ItemRef;
  title?: string;
  className?: string;
  /** Already loaded with `loadConnected` (skips a second query). */
  data?: ConnectedData;
}) {
  const { connected, viaItems } =
    data ?? (await loadConnected(item, { indirect, hideListedNotes }));

  return (
    <div role="region" aria-label={title} className={className}>
      <Section
        title={title}
        count={connected.length || undefined}
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
