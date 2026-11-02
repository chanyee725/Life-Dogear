import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHeader } from "@/components/shell";
import { EmptyState } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { tags } from "@/lib/repo";
import { parseTagSort, sortTags, tagHref, type TagSort } from "./tag-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "태그" };

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
  const list = sortTags(await tags.listAll(), sort);

  return (
    <Page>
      <PageHeader
        title="태그"
        description={
          list.length
            ? `태그 ${list.length}개 — 연구·논문·세미나·생각이 함께 씁니다.`
            : "연구·논문·세미나·생각이 함께 쓰는 태그입니다."
        }
        actions={
          list.length ? (
            <nav aria-label="정렬" className="flex items-center gap-1">
              {SORTS.map((s) => (
                <Link
                  key={s.value}
                  href={s.value === "count" ? "/tags" : `/tags?sort=${s.value}`}
                  aria-current={sort === s.value ? "true" : undefined}
                  className={cn(
                    "inline-flex h-7 items-center rounded-lg px-2.5 text-[13px] transition-colors",
                    sort === s.value ? "bg-fg text-bg" : "text-muted hover:bg-hover hover:text-fg",
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </nav>
          ) : null
        }
      />
      {list.length === 0 ? (
        <EmptyState
          title="아직 태그가 없습니다"
          description="연구·논문·세미나·생각의 상세 화면에서 태그를 달면 여기에 모입니다."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <li key={t.name}>
              <Link
                href={tagHref(t.name)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface"
              >
                <span className="min-w-0 truncate text-sm text-fg">#{t.name}</span>
                <span className="shrink-0 text-xs text-faint tabular-nums">{t.count}개</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
