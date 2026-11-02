import type { Metadata } from "next";
import Link from "next/link";
import { ItemCards } from "@/components/list/ItemCards";
import { ItemTable, type Column } from "@/components/list/ItemTable";
import { countTags, filterByTag, firstParam, type QueryParams } from "@/components/list/query";
import { SortSelect } from "@/components/list/SortSelect";
import { FilterChips, TagFilter } from "@/components/list/TagFilter";
import { TagList } from "@/components/list/TagList";
import { ListView } from "@/components/list/ViewToggle";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelative } from "@/components/ui/format";
import { THOUGHT_KIND, THOUGHT_MATURITY } from "@/lib/enums";
import { thoughts } from "@/lib/repo";
import type { Thought, ThoughtSort } from "@/lib/repo/thoughts";

export const metadata: Metadata = { title: "생각" };
export const dynamic = "force-dynamic";

const SORTS: { value: ThoughtSort; label: string }[] = [
  { value: "updated", label: "최근 수정순" },
  { value: "created", label: "최근 생성순" },
  { value: "title", label: "제목순" },
];

const href = (t: Thought) => `/thoughts/${t.id}`;

const kindBadge = (t: Thought) => (
  <Badge tone={THOUGHT_KIND.tone(t.kind)}>{THOUGHT_KIND.label(t.kind)}</Badge>
);
const maturityBadge = (t: Thought) => (
  <Badge tone={THOUGHT_MATURITY.tone(t.maturity)}>{THOUGHT_MATURITY.label(t.maturity)}</Badge>
);

/** First non-heading text line of the body, for card previews. */
function preview(body: string): string {
  const line = body
    .split("\n")
    .map((l) => l.replace(/^[#>\-*\s]+|\[[ x]\]\s*/g, "").trim())
    .find(Boolean);
  return line ?? "";
}

const columns: Column<Thought>[] = [
  { key: "title", header: "제목", primary: true, render: (t) => t.title },
  { key: "kind", header: "종류", render: kindBadge },
  { key: "maturity", header: "발전 정도", render: maturityBadge },
  { key: "tags", header: "태그", render: (t) => <TagList tags={t.tags} /> },
  {
    key: "updated",
    header: "수정",
    className: "text-muted tabular-nums whitespace-nowrap",
    render: (t) => formatRelative(t.updatedAt),
  },
];

export default async function ThoughtsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const kindParam = firstParam(params, "kind");
  const kind = THOUGHT_KIND.is(kindParam) ? kindParam : undefined;
  const maturityParam = firstParam(params, "maturity");
  const maturity = THOUGHT_MATURITY.is(maturityParam) ? maturityParam : undefined;
  const tag = firstParam(params, "tag");
  const sortParam = firstParam(params, "sort");
  const sort = SORTS.find((s) => s.value === sortParam)?.value ?? "updated";

  const all = await thoughts.list({ kind, maturity, sort });
  const items = filterByTag(all, tag);
  const filtered = Boolean(kind || maturity || tag);

  const empty = (
    <EmptyState
      title={filtered ? "조건에 맞는 생각이 없습니다" : "아직 생각이 없습니다"}
      description={
        filtered ? "필터를 바꾸거나 해제해 보세요." : "아이디어, 질문, 반론을 가볍게 적어 두세요."
      }
      action={
        filtered ? (
          <Link href="/thoughts" className={buttonClass("secondary", "sm")}>
            필터 해제
          </Link>
        ) : (
          <Link href="/thoughts/new" className={buttonClass("primary", "sm")}>
            새 생각
          </Link>
        )
      }
    />
  );

  return (
    <Page>
      <PageHeader
        title="생각"
        actions={
          <Link href="/thoughts/new" className={buttonClass("primary")}>
            새 생각
          </Link>
        }
      />
      <ListView
        storageKey="thoughts"
        toolbar={
          <>
            <FilterChips
              ariaLabel="종류 필터"
              param="kind"
              basePath="/thoughts"
              params={params}
              selected={kind}
              options={THOUGHT_KIND.options}
            />
            <div className="ml-auto">
              <SortSelect options={SORTS} value={sort} basePath="/thoughts" params={params} />
            </div>
            <FilterChips
              ariaLabel="발전 정도 필터"
              param="maturity"
              basePath="/thoughts"
              params={params}
              selected={maturity}
              options={THOUGHT_MATURITY.options}
              className="w-full"
            />
            <TagFilter
              tags={countTags(all)}
              selected={tag}
              basePath="/thoughts"
              params={params}
              className="w-full"
            />
          </>
        }
        table={
          <ItemTable
            items={items}
            columns={columns}
            getKey={(t) => t.id}
            getHref={href}
            empty={empty}
          />
        }
        cards={
          <ItemCards
            items={items}
            getKey={(t) => t.id}
            getHref={href}
            empty={empty}
            renderCard={(t) => (
              <>
                <span className="font-medium">{t.title}</span>
                {preview(t.body) ? (
                  <p className="line-clamp-3 text-[13px] text-muted">{preview(t.body)}</p>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                  {kindBadge(t)}
                  {maturityBadge(t)}
                  <TagList tags={t.tags} max={2} />
                </div>
              </>
            )}
          />
        }
      />
    </Page>
  );
}
