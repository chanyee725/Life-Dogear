import Link from "next/link";
import { ProgressBar } from "@/components/pdf/ProgressBar";
import type { Paper } from "@/lib/repo/papers";
import { DashboardEmpty, DashboardSection } from "./DashboardSection";
import { formatRelative, paperByline } from "./format";

/** Papers being read, most recent first, each opening the viewer at the saved spot. */
export function ContinueReading({ papers }: { papers: Paper[] }) {
  return (
    <DashboardSection
      id="continue-reading"
      title="이어 읽기"
      action={
        <Link href="/papers?status=reading" className="text-xs text-muted hover:text-fg">
          모두 보기
        </Link>
      }
    >
      {papers.length === 0 ? (
        <DashboardEmpty>
          읽는 중인 논문이 없습니다. 논문에 PDF를 올리고 읽기 시작하면 여기에 나타납니다.
        </DashboardEmpty>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {papers.map((paper) => {
            const byline = paperByline(paper);
            return (
              <li key={paper.id}>
                <Link
                  href={paper.pdfPath ? `/papers/${paper.id}/read` : `/papers/${paper.id}`}
                  className="flex h-full flex-col gap-2 rounded-lg border border-border p-4 transition-colors hover:border-border-strong hover:bg-surface"
                >
                  <span className="line-clamp-2 font-medium text-fg">{paper.title}</span>
                  {byline ? <span className="text-[13px] text-muted">{byline}</span> : null}
                  <ProgressBar
                    current={paper.lastPage}
                    total={paper.totalPages}
                    className="mt-auto pt-1"
                  />
                  {paper.lastReadAt ? (
                    <span className="text-xs text-faint">
                      {formatRelative(paper.lastReadAt)} 읽음
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardSection>
  );
}
