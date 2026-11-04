import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page, PageHeader } from "@/components/shell";
import { BackLink, Badge, ListRow, RowList, Section } from "@/components/ui";
import { ITEM_TYPE } from "@/lib/enums";
import { decodeTagParam, loadTagPage } from "../tag-data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = decodeTagParam((await params).name);
  // The root layout's title template appends " · Life Dogear".
  return { title: name ? `#${name}` : "주제" };
}

export default async function TagPage({ params }: Props) {
  const name = decodeTagParam((await params).name);
  const data = name ? await loadTagPage(name) : null;
  if (!data) notFound();

  return (
    <Page>
      <PageHeader eyebrow={<BackLink href="/tags">모든 주제</BackLink>} title={`#${data.name}`} />
      <div className="flex flex-col gap-10">
        {data.groups.map((group) => (
          <Section
            key={group.type}
            title={
              <>
                {group.label}
                <span aria-hidden className="ml-1.5 font-normal text-muted">
                  {group.items.length}
                </span>
              </>
            }
          >
            <RowList>
              {group.items.map((item) => (
                <ListRow key={item.id}>
                  <Badge tone={ITEM_TYPE.tone(group.type)}>{group.label}</Badge>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={item.href} className="truncate text-sm text-fg hover:underline">
                      {item.title}
                    </Link>
                    {item.meta ? (
                      <span className="truncate text-xs text-muted">{item.meta}</span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {item.badges.map((b) => (
                      <Badge key={b.label} tone={b.tone}>
                        {b.label}
                      </Badge>
                    ))}
                  </div>
                </ListRow>
              ))}
            </RowList>
          </Section>
        ))}
      </div>
    </Page>
  );
}
