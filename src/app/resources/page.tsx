import type { Metadata } from "next";
import Link from "next/link";
import { tagHref } from "@/app/tags/tag-data";
import { Page, PageHeader } from "@/components/shell";
import {
  Badge,
  ChipCount,
  ChipLink,
  EmptyState,
  formatDate,
  LinkButton,
  ListRow,
  RowList,
  Section,
} from "@/components/ui";
import { ITEM_TYPE } from "@/lib/enums";
import {
  countByType,
  filterByType,
  loadResources,
  parseSortParam,
  parseTopicParam,
  parseTypeParam,
  RESOURCE_TYPES,
  resourcesHref,
  type ResourceItem,
  type ResourceType,
} from "./resource-data";
import { TopicIndex } from "./TopicIndex";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "자료" };

/**
 * `/resources` — 자료 by topic: a topic index (filter, most-items or 가나다 order with
 * density bars) beside the chosen topic's papers, notes, seminars and thoughts (`?topic=`,
 * narrowed by `?type=`). With no topic, the most recently updated resources.
 */
export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sort = parseSortParam(params.sort);
  const type = parseTypeParam(params.type);
  const data = await loadResources(parseTopicParam(params.topic));
  const { topics, topic, items, recent } = data;

  const recentSection =
    recent.length > 0 ? (
      <Section title="최근 자료">
        <ResourceRows items={recent} />
      </Section>
    ) : null;

  return (
    <Page>
      <PageHeader title="자료" />

      {topics.length === 0 ? (
        <div className="@container flex flex-col gap-8">
          <EmptyState title="아직 주제가 없습니다" />
          {recentSection}
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
          <TopicIndex
            topics={topics.map((t) => ({
              ...t,
              href: resourcesHref(t.name === topic ? null : t.name, { sort }),
            }))}
            selected={topic}
            sort={sort}
            sortHrefs={{
              count: resourcesHref(topic, { type, sort: "count" }),
              name: resourcesHref(topic, { type, sort: "name" }),
            }}
          />

          <div className="@container min-w-0">
            {data.unknownTopic ? (
              <EmptyState
                title="이 주제를 찾을 수 없습니다"
                action={
                  <LinkButton href={resourcesHref(null, { sort })} size="sm">
                    최근 자료 보기
                  </LinkButton>
                }
              />
            ) : !topic ? (
              (recentSection ?? <EmptyState title="아직 자료가 없습니다" />)
            ) : (
              <TopicItems topic={topic} items={items} type={type} sort={sort} />
            )}
          </div>
        </div>
      )}
    </Page>
  );
}

function TopicItems({
  topic,
  items,
  type,
  sort,
}: {
  topic: string;
  items: ResourceItem[];
  type: ResourceType | null;
  sort: ReturnType<typeof parseSortParam>;
}) {
  const counts = countByType(items);
  const shown = filterByType(items, type);
  const tabs: { value: ResourceType | null; label: string; count: number }[] = [
    { value: null, label: "전체", count: items.length },
    ...RESOURCE_TYPES.map((t) => ({ value: t, label: ITEM_TYPE.label(t), count: counts[t] })),
  ];

  return (
    <Section
      title={
        <>
          #{topic}
          <span aria-hidden className="ml-1.5 font-normal tabular-nums">
            {items.length}
          </span>
        </>
      }
      action={
        <LinkButton
          href={tagHref(topic)}
          variant="ghost"
          size="sm"
          className="hidden @[18rem]:inline-flex"
        >
          주제의 모든 항목
        </LinkButton>
      }
    >
      <nav aria-label="유형" className="flex flex-wrap items-center gap-1">
        {tabs.map((tab) => {
          const active = tab.value === type;
          return (
            <ChipLink
              key={tab.value ?? "all"}
              href={resourcesHref(topic, { type: tab.value, sort })}
              scroll={false}
              active={active}
            >
              {tab.label}
              <ChipCount>{tab.count}</ChipCount>
            </ChipLink>
          );
        })}
      </nav>

      {shown.length === 0 ? (
        <EmptyState
          title={
            type
              ? `이 주제의 ${withSubject(ITEM_TYPE.label(type))} 아직 없습니다`
              : "이 주제의 자료가 없습니다"
          }
          action={
            type ? (
              <LinkButton href={resourcesHref(topic, { sort })} size="sm">
                전체 보기
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <ResourceRows items={shown} />
      )}
    </Section>
  );
}

/** Noun + 이/가, by whether the last syllable has a final consonant. */
function withSubject(noun: string): string {
  const code = (noun.at(-1) ?? "").charCodeAt(0) - 0xac00;
  return `${noun}${code >= 0 && code < 11172 && code % 28 !== 0 ? "이" : "가"}`;
}

/** One dense row per resource: kind, title (+ meta on wider screens), status, date. */
function ResourceRows({ items }: { items: readonly ResourceItem[] }) {
  return (
    <RowList>
      {items.map((item) => (
        <ListRow key={`${item.type}:${item.id}`}>
          <Badge tone={ITEM_TYPE.tone(item.type)} className="w-11 shrink-0 justify-center">
            {ITEM_TYPE.label(item.type)}
          </Badge>
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <Link href={item.href} className="min-w-0 truncate text-sm text-fg hover:underline">
              {item.title}
            </Link>
            {item.meta ? (
              <span className="hidden min-w-0 shrink-[3] truncate text-xs text-muted @[36rem]:block">
                {item.meta}
              </span>
            ) : null}
          </div>
          {item.status ? (
            <Badge tone={item.status.tone} className="hidden shrink-0 @[18rem]:inline-flex">
              {item.status.label}
            </Badge>
          ) : null}
          <span className="hidden shrink-0 text-xs text-muted tabular-nums @[24rem]:inline">
            {formatDate(item.updatedAt)}
          </span>
        </ListRow>
      ))}
    </RowList>
  );
}
