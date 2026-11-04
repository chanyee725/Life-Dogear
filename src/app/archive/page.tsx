import type { Metadata } from "next";
import Link from "next/link";
import { itemPath } from "@/app/_actions/parse";
import { ArchiveButton } from "@/components/fields/ArchiveButton";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { Section } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/components/ui/format";
import { ITEM_TYPE, type ItemType } from "@/lib/enums";
import { archive } from "@/lib/repo";

export const metadata: Metadata = { title: "보관함" };
export const dynamic = "force-dynamic";

const ORDER: ItemType[] = [
  "goal",
  "project",
  "area",
  "paper",
  "note",
  "seminar",
  "thought",
  "review",
];

export default async function ArchivePage() {
  const items = await archive.listArchived();
  const groups = ORDER.map((type) => ({
    type,
    items: items.filter((i) => i.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <Page>
      <PageHeader
        title="보관함"
        description="보관한 항목은 목록과 홈에서 빠집니다. 여기서 다시 꺼낼 수 있습니다."
      />
      {groups.length === 0 ? (
        <EmptyState
          title="보관한 항목이 없습니다"
          description="상세 화면의 '보관'으로 끝난 일을 치워 둘 수 있습니다."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <Section
              key={group.type}
              title={`${ITEM_TYPE.label(group.type)} ${group.items.length}`}
            >
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {group.items.map((item) => (
                  <li key={item.ref.id} className="flex items-center gap-3 px-3 py-2">
                    <Link
                      href={itemPath(item.ref)}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                    >
                      {item.title}
                    </Link>
                    <span className="text-xs text-muted tabular-nums">
                      보관 {formatDate(item.archivedAt)}
                    </span>
                    <ArchiveButton item={item.ref} archived />
                  </li>
                ))}
              </ul>
            </Section>
          ))}
        </div>
      )}
    </Page>
  );
}
