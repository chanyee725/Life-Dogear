"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type ReactNode } from "react";
import { Button, cn, Spinner } from "@/components/ui";
import { uploadPaperPdf } from "./pdf-client";

/** Hidden file input plus upload state; `open()` shows the file picker. */
function usePdfPicker(paperId: string) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    const message = await uploadPaperPdf(paperId, file);
    setUploading(false);
    if (message) setError(message);
    else router.refresh();
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf,.pdf"
      className="hidden"
      tabIndex={-1}
      onChange={(e) => {
        void upload(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  return { input, open: () => inputRef.current?.click(), upload, uploading, error };
}

/** Drop zone shown when a paper has no PDF yet. */
export function PdfDropZone({ paperId, className }: { paperId: string; className?: string }) {
  const { input, open, upload, uploading, error } = usePdfPicker(paperId);
  const [dragging, setDragging] = useState(false);
  const hintId = useId();

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload(e.dataTransfer.files[0]);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
        dragging ? "border-accent bg-accent-soft" : "border-border",
        className,
      )}
    >
      {input}
      <p id={hintId} className="text-sm text-muted">
        PDF를 끌어다 놓거나 파일을 선택하세요.
      </p>
      <Button variant="secondary" onClick={open} disabled={uploading} aria-describedby={hintId}>
        {uploading ? (
          <>
            <Spinner /> 올리는 중…
          </>
        ) : (
          "PDF 올리기"
        )}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Small "PDF 교체" button for a paper that already has a PDF. */
export function ReplacePdfButton({
  paperId,
  children = "PDF 교체",
}: {
  paperId: string;
  children?: ReactNode;
}) {
  const { input, open, uploading, error } = usePdfPicker(paperId);
  return (
    <>
      {input}
      <Button variant="ghost" size="sm" onClick={open} disabled={uploading}>
        {uploading ? "올리는 중…" : children}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </>
  );
}
