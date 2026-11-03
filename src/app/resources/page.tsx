import type { Metadata } from "next";
import Link from "next/link";
import { tagHref } from "@/app/tags/tag-data";
import { filterChipClass } from "@/components/list/TagFilter";
import { Page, PageHeader } from "@/components/shell";
import { Badge, EmptyState, Section } from "@/components/ui";
import { buttonClass } from "@/components/ui/Button";
import { formatDate } from "@/components/ui/format";
import { ITEM_TYPE } from "@/lib/enums";
import { loadResources, parseTopicParam, resourcesHref } from "./resource-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "자료" };

/**
 * `/resources` — 자료 by topic: the topic list first; `?topic=` shows that topic's papers,
 * seminars and thoughts together (kind badge, most recent first, archived left out).
 */
export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await loadResources(parseTopicParam((await searchParams).topic));
  const { topics, topic, items } = data;

  return (
    <Page>
      <PageHeader
        title="자료"
        description="주제를 고르면 그 주제의 논문·세미나·생각을 함께 봅니다."
      />

      {topics.length === 0 ? (
        <EmptyState
          title="아직 주제가 없습니다"
          description="논문·세미나·생각에 주제를 달면 여기서 주제별로 모아 볼 수 있습니다. 프로젝트·영역·목표에만 쓴 주제는 '주제' 화면에서 봅니다."
        />
      ) : (
        <div className="flex flex-col gap-8">
          <nav aria-label="주제" className="flex flex-wrap gap-1.5">
            {topics.map((t) => {
              const active = t.name === topic;
              return (
                <Link
                  key={t.name}
                  href={active ? resourcesHref() : resourcesHref(t.name)}
                  aria-current={active ? "true" : undefined}
                  className={filterChipClass(active)}
                >
                  #{t.name}
                </Link>
              );
            })}
          </nav>

          {data.unknownTopic ? (
            <EmptyState
              title="이 주제를 찾을 수 없습니다"
              description="논문·세미나·생각에 쓰인 주제가 아니거나, 보관한 항목에만 쓰였을 수 있습니다."
              action={
                <Link href={resourcesHref()} className={buttonClass("secondary", "sm")}>
                  주제 목록 보기
                </Link>
              }
            />
          ) : !topic ? (
            <p className="text-sm text-muted">위에서 주제를 고르세요.</p>
          ) : (
            <Section
              title={
                <>
                  #{topic}
                  <span aria-hidden className="ml-1.5 font-normal text-muted">
                    {items.length}
                  </span>
                </>
              }
              action={
                <Link href={tagHref(topic)} className={buttonClass("ghost", "sm")}>
                  주제의 모든 항목
                </Link>
              }
            >
              {items.length === 0 ? (
                <EmptyState title="이 주제의 자료가 없습니다" />
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {items.map((item) => (
                    <li
                      key={`${item.type}:${item.id}`}
                      className="flex items-center gap-2.5 px-3 py-2.5"
                    >
                      <Badge tone={ITEM_TYPE.tone(item.type)}>{ITEM_TYPE.label(item.type)}</Badge>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link href={item.href} className="truncate text-sm text-fg hover:underline">
                          {item.title}
                        </Link>
                        {item.meta ? (
                          <span className="truncate text-xs text-muted">{item.meta}</span>
                        ) : null}
                      </div>
                      {item.status ? (
                        <Badge tone={item.status.tone}>{item.status.label}</Badge>
                      ) : null}
                      <span className="shrink-0 text-xs text-muted tabular-nums">
                        {formatDate(item.updatedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </div>
      )}
    </Page>
  );
}
