"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProgressBar } from "@/components/pdf/ProgressBar";
import { useLatestProgress } from "@/components/pdf/useLatestProgress";
import { Button, ConfirmDialog, LinkButton, Section } from "@/components/ui";
import { removePaperPdf } from "./pdf-client";
import { PdfDropZone, ReplacePdfButton } from "./PdfUploader";
import { itemPath } from "@/lib/item-path";

type PdfPanelProps = {
  paperId: string;
  /** Slug for the reader link; optional, the short id alone also resolves. */
  paperTitle?: string | null;
  hasPdf: boolean;
  lastPage: number | null;
  totalPages: number | null;
  lastReadAt: string | null;
};

/** PDF block on the paper page: continue reading, progress, replace/remove, or upload. */
export function PdfPanel({
  paperId,
  paperTitle,
  hasPdf,
  lastPage,
  totalPages,
  lastReadAt,
}: PdfPanelProps) {
  const router = useRouter();
  // The page may be shown from the router cache after reading; catch up with the server.
  const latest = useLatestProgress(hasPdf ? `/api/papers/${paperId}/progress` : null, {
    page: lastPage,
    scroll: null,
    totalPages,
    lastReadAt,
  });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasPdf) {
    return (
      <Section title="PDF">
        <PdfDropZone paperId={paperId} />
      </Section>
    );
  }

  return (
    <Section title="PDF">
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <LinkButton href={`${itemPath("papers", paperId, paperTitle)}/read`} variant="primary">
            {latest.page ? `이어 읽기 · ${latest.page}쪽` : "이어 읽기"}
          </LinkButton>
          <ProgressBar
            current={latest.page}
            total={latest.totalPages}
            className="min-w-40 flex-1"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <ReplacePdfButton paperId={paperId} />
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            PDF 제거
          </Button>
          {error ? (
            <span role="alert" className="text-xs text-danger">
              {error}
            </span>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          const message = await removePaperPdf(paperId);
          setConfirming(false);
          setError(message);
          if (!message) router.refresh();
        }}
        title="PDF를 제거할까요?"
        description="파일과 읽던 위치가 지워집니다. 논문 메모는 그대로 남습니다."
        confirmLabel="제거"
        danger
      />
    </Section>
  );
}
