import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaperHighlights } from "@/components/highlights";
import { ConnectedWithGraph } from "@/components/graph/ConnectedWithGraph";
import { Page } from "@/components/shell";
import { isValidItemId } from "@/lib/ids";
import { papers, tags } from "@/lib/repo";
import * as highlightsRepo from "@/lib/repo/highlights";
import { PaperEditor } from "../_components/PaperEditor";
import { PdfPanel } from "../_components/PdfPanel";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  return isValidItemId(id) ? papers.get(id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const paper = await load((await params).id);
  return { title: paper?.title ?? "논문" };
}

export default async function PaperPage({ params }: Props) {
  const { id } = await params;
  const [paper, allTags, paperHighlights] = await Promise.all([
    load(id),
    tags.listAll(),
    highlightsRepo.listByPaper(id), // [] for an invalid id
  ]);
  if (!paper) notFound();

  return (
    <Page className="flex flex-col gap-12">
      <PaperEditor
        // Fresh editor state per paper; our own saves keep the same key.
        key={paper.id}
        paper={paper}
        tagSuggestions={allTags.map((t) => t.name)}
        pdfSlot={
          <PdfPanel
            paperId={paper.id}
            hasPdf={Boolean(paper.pdfPath)}
            lastPage={paper.lastPage}
            totalPages={paper.totalPages}
            lastReadAt={paper.lastReadAt}
          />
        }
      />
      <PaperHighlights
        paperId={paper.id}
        initialHighlights={paperHighlights}
        hasPdf={Boolean(paper.pdfPath)}
      />
      <ConnectedWithGraph item={{ type: "paper", id: paper.id }} />
    </Page>
  );
}
