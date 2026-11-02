import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import { Page, PageHeader } from "@/components/shell";
import { isValidItemId } from "@/lib/ids";
import { papers } from "@/lib/repo";
import { PdfDropZone } from "../../_components/PdfUploader";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  return isValidItemId(id) ? papers.get(id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const paper = await load((await params).id);
  return { title: paper ? `${paper.title} 읽기` : "논문" };
}

export default async function ReadPaperPage({ params }: Props) {
  const { id } = await params;
  const paper = await load(id);
  if (!paper) notFound();

  const back = (
    <Link
      href={`/papers/${paper.id}`}
      className="shrink-0 rounded-md px-2 py-1 text-muted hover:bg-hover hover:text-fg"
      aria-label="논문으로 돌아가기"
    >
      ←
    </Link>
  );

  if (!paper.pdfPath) {
    return (
      <Page>
        <PageHeader
          eyebrow={
            <Link href={`/papers/${paper.id}`} className="hover:text-fg">
              ← {paper.title}
            </Link>
          }
          title="PDF가 없습니다"
          description="이 논문에 PDF를 올리면 여기에서 바로 읽고, 다음에 읽던 곳부터 이어 읽을 수 있어요."
        />
        <PdfDropZone paperId={paper.id} />
      </Page>
    );
  }

  // setPdf bumps updatedAt, so a replaced file gets a fresh viewer and URL;
  // saving the reading position does not.
  const version = encodeURIComponent(paper.updatedAt);

  return (
    <div className="flex h-dvh flex-col">
      <PdfViewer
        key={paper.updatedAt}
        file={`/api/papers/${paper.id}/pdf?v=${version}`}
        progressUrl={`/api/papers/${paper.id}/progress`}
        initialPage={paper.lastPage}
        initialScroll={paper.lastScroll}
        header={
          <>
            {back}
            <h1 className="min-w-0 truncate text-sm font-medium text-fg" title={paper.title}>
              {paper.title}
            </h1>
          </>
        }
      />
    </div>
  );
}
