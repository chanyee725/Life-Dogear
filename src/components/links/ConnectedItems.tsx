import Link from "next/link";
import { itemPath } from "@/app/_actions/parse";
import { Badge, Section } from "@/components/ui";
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
        {connected.length === 0 ? (
          <p className="text-[13px] text-muted">
            아직 연결된 항목이 없습니다. 관련 프로젝트·영역·논문·세미나·생각을 연결해 보세요.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {connected.map((c) => (
              <li key={refKey(c.ref)} className="group flex items-center gap-2.5 px-3 py-2">
                <Badge tone={ITEM_TYPE.tone(c.type)}>{ITEM_TYPE.label(c.type)}</Badge>
                <Link
                  href={itemPath(c.ref)}
                  className="min-w-0 flex-1 truncate text-sm text-fg hover:underline"
                >
                  {c.title}
                </Link>
                {c.archived ? <Badge tone="gray">보관됨</Badge> : null}
                <UnlinkButton item={item} other={c.ref} otherTitle={c.title} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
