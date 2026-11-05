import Link from "next/link";
import type { Paper } from "@/lib/repo/papers";
import { Section, cardClass, cardLinkClass, cn } from "@/components/ui";
import { paperByline } from "./format";
import { LatestReading } from "./LatestReading";

/** Papers being read, most recent first, each opening the viewer at the saved spot. */
export function ContinueReading({ papers }: { papers: Paper[] }) {
  // Nothing to resume: the block has no action of its own, so it is hidden.
  if (papers.length === 0) return null;
  return (
    <Section
      id="continue-reading"
      title="이어 읽기"
      action={
        <Link href="/papers?status=reading" className="text-xs text-muted hover:text-fg">
          모두 보기
        </Link>
      }
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {papers.map((paper) => {
          const byline = paperByline(paper);
          return (
            <li key={paper.id}>
              <Link
                href={paper.pdfPath ? `/papers/${paper.id}/read` : `/papers/${paper.id}`}
                className={cn(cardClass, cardLinkClass, "flex h-full flex-col gap-2")}
              >
                <span className="line-clamp-2 font-medium text-fg">{paper.title}</span>
                {byline ? <span className="text-[13px] text-muted">{byline}</span> : null}
                <LatestReading
                  paperId={paper.id}
                  hasPdf={Boolean(paper.pdfPath)}
                  page={paper.lastPage}
                  totalPages={paper.totalPages}
                  lastReadAt={paper.lastReadAt}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
