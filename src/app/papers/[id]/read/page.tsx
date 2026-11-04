import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HighlightReader } from "@/components/highlights";
import { FocusModeToggle } from "@/components/shell/FocusModeToggle";
import { Page, PageHeader } from "@/components/shell";
import { parseJumpParams } from "@/lib/highlights";
import { isValidItemId } from "@/lib/ids";
import { papers } from "@/lib/repo";
import * as highlightsRepo from "@/lib/repo/highlights";
import { PdfDropZone } from "../../_components/PdfUploader";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function load(id: string) {
  return isValidItemId(id) ? papers.get(id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const paper = await load((await params).id);
  return { title: paper ? `${paper.title} 읽기` : "논문" };
}

export default async function ReadPaperPage({ params, searchParams }: Props) {
  const { id } = await params;
  const paper = await load(id);
  if (!paper) notFound();

  const back = (
    <Link
      href={`/papers/${paper.id}`}
      // In focus mode the shell's fixed "사이드바 열기" button sits at the top-left corner.
      className="shrink-0 rounded-md px-2 py-1 text-muted hover:bg-hover hover:text-fg in-data-[sidebar=collapsed]:ml-9"
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
        />
        <PdfDropZone paperId={paper.id} />
      </Page>
    );
  }

  // setPdf bumps updatedAt, so a replaced file gets a fresh viewer and URL;
  // saving the reading position does not.
  const version = encodeURIComponent(paper.updatedAt);
  // `?page=N[&scroll=0–1]` (highlight list, search palette) overrides the saved position.
  const jump = parseJumpParams(await searchParams);
  const highlights = await highlightsRepo.listByPaper(paper.id);

  return (
    <div className="flex h-dvh flex-col">
      <HighlightReader
        // A new ?page= jump (e.g. from the search palette) remounts at that position.
        key={`${paper.updatedAt}:${jump?.page ?? ""}:${jump?.scroll ?? ""}`}
        paperId={paper.id}
        initialHighlights={highlights}
        file={`/api/papers/${paper.id}/pdf?v=${version}`}
        progressUrl={`/api/papers/${paper.id}/progress`}
        initialPage={jump?.page ?? paper.lastPage}
        initialScroll={jump ? jump.scroll : paper.lastScroll}
        initialReadAt={paper.lastReadAt}
        // Focus mode hides the sidebar (remembered); the reader then fills the width.
        toolbarEnd={<FocusModeToggle />}
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
