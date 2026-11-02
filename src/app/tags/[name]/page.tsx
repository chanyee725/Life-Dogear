import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page, PageHeader } from "@/components/shell";
import { Badge, Section } from "@/components/ui";
import { ITEM_TYPE } from "@/lib/enums";
import { decodeTagParam, loadTagPage } from "../tag-data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = decodeTagParam((await params).name);
  return { title: name ? `#${name} · Research Brain` : "태그 · Research Brain" };
}

export default async function TagPage({ params }: Props) {
  const name = decodeTagParam((await params).name);
  const data = name ? await loadTagPage(name) : null;
  if (!data) notFound();

  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/tags" className="hover:text-fg">
            ← 모든 태그
          </Link>
        }
        title={`#${data.name}`}
        description={`이 태그가 달린 항목 ${data.total}개`}
      />
      <div className="flex flex-col gap-10">
        {data.groups.map((group) => (
          <Section
            key={group.type}
            title={
              <>
                {group.label}
                <span aria-hidden className="ml-1.5 font-normal text-faint">
                  {group.items.length}
                </span>
              </>
            }
          >
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {group.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <Badge tone={ITEM_TYPE.tone(group.type)}>{group.label}</Badge>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={item.href} className="truncate text-sm text-fg hover:underline">
                      {item.title}
                    </Link>
                    {item.meta ? (
                      <span className="truncate text-xs text-faint">{item.meta}</span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {item.badges.map((b) => (
                      <Badge key={b.label} tone={b.tone}>
                        {b.label}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        ))}
      </div>
    </Page>
  );
}
