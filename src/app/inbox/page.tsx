import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/components/ui/format";
import { tags, thoughts } from "@/lib/repo";
import { InboxItem } from "./InboxItem";

export const metadata: Metadata = { title: "수집함" };
export const dynamic = "force-dynamic";

/** First non-heading text line of a markdown body. */
function preview(body: string): string {
  return (
    body
      .split("\n")
      .map((l) =>
        l
          .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // photos: not text
          .replace(/^[#>\-*\s]+|\[[ x]\]\s*/g, "")
          .trim(),
      )
      .find(Boolean) ?? ""
  );
}

export default async function InboxPage() {
  const [items, allTags] = await Promise.all([
    thoughts.listInbox(),
    tags.listAll({ visibleOnly: true }),
  ]);
  const suggestions = allTags.map((t) => t.name);

  return (
    <Page>
      <PageHeader
        title="수집함"
        description="태그도 연결도 없는 생각들. 태그를 달거나 연결하면 정리된 것으로 보고 여기서 빠집니다."
        actions={
          <Link href="/thoughts/new" className={buttonClass("secondary")}>
            새 생각
          </Link>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          title="수집함이 비었습니다"
          description="홈의 빠른 입력으로 떠오른 생각을 바로 적어 보세요."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {items.map((t) => (
            <InboxItem
              key={t.id}
              id={t.id}
              title={t.title}
              preview={preview(t.body)}
              created={formatDate(t.createdAt)}
              tagSuggestions={suggestions}
            />
          ))}
        </ul>
      )}
    </Page>
  );
}
