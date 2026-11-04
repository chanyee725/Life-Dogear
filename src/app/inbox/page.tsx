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
        actions={
          <Link
            aria-keyshortcuts="N"
            title="단축키 N"
            href="/thoughts/new"
            className={buttonClass("secondary")}
          >
            새 생각
          </Link>
        }
      />
      {items.length === 0 ? (
        <EmptyState title="수집함이 비었습니다" />
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
