import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/ui";
import { tags } from "@/lib/repo";
import { parseTagSort, sortTags, tagHref, type TagSort } from "./tag-data";
import { ChipLink } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "주제" };

const SORTS: { value: TagSort; label: string }[] = [
  { value: "count", label: "많이 쓴 순" },
  { value: "name", label: "이름순" },
];

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sort = parseTagSort((await searchParams).sort);
  const list = sortTags(await tags.listAll({ visibleOnly: true }), sort);

  return (
    <Page>
      <PageHeader
        title="주제"
        actions={
          list.length ? (
            <nav aria-label="정렬" className="flex items-center gap-1">
              {SORTS.map((s) => (
                <ChipLink
                  key={s.value}
                  href={s.value === "count" ? "/tags" : `/tags?sort=${s.value}`}
                  active={sort === s.value}
                >
                  {s.label}
                </ChipLink>
              ))}
            </nav>
          ) : null
        }
      />
      {list.length === 0 ? (
        <EmptyState title="아직 주제가 없습니다" />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <li key={t.name}>
              <Link
                href={tagHref(t.name)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface"
              >
                <span className="min-w-0 truncate text-sm text-fg">#{t.name}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">{t.count}개</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
