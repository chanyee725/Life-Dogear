"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { setItemTags } from "@/app/_actions/tags";
import { safeAction } from "@/components/links/safe-action";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { EnumSelect } from "@/components/fields/EnumSelect";
import { TagInput } from "@/components/fields/TagInput";
import { Button, buttonClass, Field, Input } from "@/components/ui";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import { IMPORTANCE, READ_STATUS, type Importance, type ReadStatus } from "@/lib/enums";
import type { Paper } from "@/lib/repo/papers";
import { updatePaper } from "../actions";
import { AuthorsField } from "./AuthorsField";
import { DeletePaperButton } from "./DeletePaperButton";
import { createSaveQueue, type SaveState } from "./save-queue";

type PatchInput = {
  title?: string;
  authors?: string[];
  year?: string;
  venue?: string;
  doi?: string;
  url?: string;
  readStatus?: ReadStatus;
  importance?: Importance;
  summary?: string;
  body?: string;
};

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  pending: "저장 대기 중",
  saving: "저장 중…",
  saved: "저장됨",
  error: "저장 실패",
};

const AUTOSAVE_DELAY = 1000;

/**
 * Paper detail editor. Edits autosave about a second after typing stops; "저장"
 * saves immediately. Failed changes are kept and retried with the next save.
 */
export function PaperEditor({
  paper,
  tagSuggestions,
  pdfSlot,
}: {
  paper: Paper;
  tagSuggestions: string[];
  /** Rendered between the fields and the body (the PDF panel). */
  pdfSlot?: ReactNode;
}) {
  const [title, setTitle] = useState(paper.title);
  const [body, setBody] = useState(paper.body);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [titleEmpty, setTitleEmpty] = useState(false);
  const [yearInvalid, setYearInvalid] = useState(false);
  const paperId = paper.id;

  // One queue per editor; failures keep the fields for the next save (see save-queue.ts).
  const [queue] = useState(() =>
    createSaveQueue<PatchInput>(
      (patch) => safeAction(() => updatePaper(paperId, patch)),
      (next, message) => {
        setState(next);
        if (next === "error") setError(message);
        else if (next === "saved") setError(null);
      },
    ),
  );
  const autosave = useDebouncedCallback(() => void queue.flush(), AUTOSAVE_DELAY, {
    flushOnUnmount: true,
  });

  function change(patch: PatchInput) {
    queue.add(patch);
    autosave();
  }

  function saveNow() {
    autosave.cancel();
    void queue.flush();
  }

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (queue.dirty()) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [queue]);

  async function saveTags(names: string[]) {
    const result = await safeAction(() => setItemTags({ type: "paper", id: paperId }, names));
    if (!result.ok) {
      setError(result.error);
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 text-[13px] text-muted">
          <Link href="/papers" className="hover:text-fg">
            ← 논문
          </Link>
          <div className="flex items-center gap-2">
            <span aria-live="polite" className={state === "error" ? "text-danger" : "text-faint"}>
              {SAVE_LABEL[state]}
            </span>
            <Button variant="secondary" size="sm" onClick={saveNow}>
              저장
            </Button>
            <DeletePaperButton paperId={paper.id} title={paper.title} />
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <label htmlFor="paper-title" className="sr-only">
          제목
        </label>
        <input
          id="paper-title"
          value={title}
          maxLength={300}
          placeholder="제목"
          onChange={(e) => {
            const value = e.target.value;
            setTitle(value);
            // An empty title would be rejected and hold back the other fields.
            setTitleEmpty(!value.trim());
            if (value.trim()) change({ title: value });
          }}
          aria-invalid={titleEmpty || undefined}
          aria-describedby={titleEmpty ? "paper-title-hint" : undefined}
          className="w-full bg-transparent text-2xl font-semibold tracking-tight text-fg placeholder:text-faint focus:outline-none"
        />
        {titleEmpty ? (
          <p id="paper-title-hint" className="-mt-2 text-xs text-danger">
            제목을 입력하세요. 비어 있는 동안 제목은 저장되지 않습니다.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="저자" htmlFor="paper-authors" className="sm:col-span-2">
          <AuthorsField
            id="paper-authors"
            defaultValue={paper.authors}
            onCommit={(authors) => {
              if (authors.join("\n") !== (queue.pending().authors ?? paper.authors).join("\n")) {
                change({ authors });
              }
            }}
          />
        </Field>
        <TextField
          id="paper-year"
          label="연도"
          defaultValue={paper.year?.toString() ?? ""}
          inputMode="numeric"
          placeholder="2024"
          // Queue only complete values so a half-typed year doesn't block other saves.
          error={yearInvalid ? "4자리 연도로 입력하세요. 예: 2024" : undefined}
          onChange={(year) => {
            const valid = /^(\d{4})?$/.test(year.trim());
            setYearInvalid(!valid);
            if (valid) change({ year });
          }}
        />
        <TextField
          id="paper-venue"
          label="학술지·학회"
          defaultValue={paper.venue}
          onChange={(venue) => change({ venue })}
        />
        <TextField
          id="paper-doi"
          label="DOI"
          defaultValue={paper.doi}
          placeholder="10.xxxx/xxxxx"
          onChange={(doi) => change({ doi })}
        />
        <TextField
          id="paper-url"
          label="링크"
          defaultValue={paper.url}
          placeholder="https://"
          onChange={(url) => change({ url })}
          after={
            paper.url && /^https?:\/\//i.test(paper.url) ? (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("ghost", "sm")}
              >
                열기 ↗
              </a>
            ) : null
          }
        />
        <Field label="읽기 상태" htmlFor="paper-status">
          <EnumSelect
            id="paper-status"
            options={READ_STATUS.options}
            defaultValue={paper.readStatus}
            onChange={(value) => value && change({ readStatus: value })}
          />
        </Field>
        <Field label="중요도" htmlFor="paper-importance">
          <EnumSelect
            id="paper-importance"
            options={IMPORTANCE.options}
            defaultValue={paper.importance}
            onChange={(value) => value && change({ importance: value })}
          />
        </Field>
        <TextField
          id="paper-summary"
          label="한 줄 요약"
          defaultValue={paper.summary}
          className="sm:col-span-2"
          onChange={(summary) => change({ summary })}
        />
        <Field label="태그" htmlFor="paper-tags" className="sm:col-span-2">
          <TagInput
            id="paper-tags"
            defaultValue={paper.tags}
            suggestions={tagSuggestions}
            onChange={(names) => void saveTags(names)}
          />
        </Field>
      </div>

      {pdfSlot}

      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold text-muted">본문</h2>
        <MarkdownEditor
          value={body}
          onChange={(markdown) => {
            setBody(markdown);
            change({ body: markdown });
          }}
        />
      </section>
    </div>
  );
}

function TextField({
  id,
  label,
  defaultValue,
  onChange,
  placeholder,
  inputMode,
  className,
  after,
  error,
}: {
  id: string;
  label: string;
  defaultValue: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "numeric";
  className?: string;
  after?: ReactNode;
  error?: string;
}) {
  return (
    <Field label={label} htmlFor={id} className={className} error={error}>
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          defaultValue={defaultValue}
          placeholder={placeholder}
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {after}
      </div>
    </Field>
  );
}
