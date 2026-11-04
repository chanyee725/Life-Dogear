"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { setItemTags } from "@/app/_actions/tags";
import { safeAction } from "@/components/links/safe-action";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { WikiRenamePrompt } from "@/components/editor/WikiRenamePrompt";
import { EnumSelect } from "@/components/fields/EnumSelect";
import { TagInput } from "@/components/fields/TagInput";
import { useUnsavedChangesGuard } from "@/components/fields/useUnsavedChangesGuard";
import { DetailBody, DetailHeader, SaveStatus, TitleInput } from "@/components/fields/ItemDetail";
import { Properties, Property } from "@/components/fields/Properties";
import { LinerMemoDialog, OpenInLiner } from "@/components/liner";
import { FillFromLink } from "@/components/metadata/FillFromLink";
import { metadataToFields } from "@/components/metadata/apply";
import { Button, buttonClass, cn, Input } from "@/components/ui";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import { appendLinerMemoEntry } from "@/lib/liner";
import { IMPORTANCE, READ_STATUS, type Importance, type ReadStatus } from "@/lib/enums";
import type { Paper } from "@/lib/repo/papers";
import { updatePaper } from "../actions";
import { ArchivePaperButton } from "./ArchivePaperButton";
import { AuthorsField } from "./AuthorsField";
import { DeletePaperButton } from "./DeletePaperButton";
import {
  createLatestSender,
  createSaveQueue,
  type SaveState,
} from "@/components/fields/save-queue";

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
  // "링크로 채우기": filled values replace the defaults; uncontrolled fields remount.
  const [fillVersion, setFillVersion] = useState(0);
  const [filled, setFilled] = useState<Partial<PatchInput>>({});
  const current = {
    authors: paper.authors,
    year: paper.year?.toString() ?? "",
    venue: paper.venue,
    doi: paper.doi,
    url: paper.url,
    ...filled,
  };
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
      // Server values: only real differences are saved, so opening the page never writes.
      serverValues(paper),
    ),
  );
  // A refresh brings new server values; adopt them as the baseline when nothing is unsaved.
  useEffect(() => {
    queue.resetBaseline(serverValues(paper));
  }, [queue, paper]);
  /**
   * The editor may re-serialise the stored Markdown right after loading (same
   * content, different text). Body changes count only once the user has typed,
   * clicked, pasted, dropped or otherwise input (dictation, virtual keyboards and
   * assistive tech fire `beforeinput`) inside the editor.
   */
  const bodyTouched = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const touchBody = () => {
    bodyTouched.current = true;
  };
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onBeforeInput = () => {
      bodyTouched.current = true;
    };
    el.addEventListener("beforeinput", onBeforeInput, { capture: true });
    return () => el.removeEventListener("beforeinput", onBeforeInput, { capture: true });
  }, []);
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

  // Unsaved = waiting for autosave, saving, kept after a failed save, or tags being
  // saved or whose last save failed. Asks before leaving via in-app links, reload or tab close.
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [tagsSaving, setTagsSaving] = useState(false);
  const dirty =
    tagsSaving ||
    tagsError !== null ||
    ((state === "pending" || state === "saving" || state === "error") && queue.dirty());
  useUnsavedChangesGuard(dirty);

  // Tag saves go out one at a time with only the newest list, so a quick second
  // change can never be overwritten by the first response arriving late.
  const [saveTags] = useState(() =>
    createLatestSender<string[]>(
      (names) => safeAction(() => setItemTags({ type: "paper", id: paperId }, names)),
      (outcome) => setTagsError(outcome.ok ? null : outcome.error),
      setTagsSaving,
    ),
  );

  return (
    // Same structure as the other detail pages (ItemForm): back link and actions,
    // title, label/value property rows, then the body.
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <DetailHeader
          backHref="/papers"
          backLabel="논문"
          status={
            // A failed tag save stays visible even after field saves succeed.
            tagsError && state !== "error" ? (
              <span aria-live="polite" className="text-xs text-danger">
                태그 저장 실패
              </span>
            ) : (
              <SaveStatus state={state} />
            )
          }
          actions={
            <>
              <OpenInLiner title={title} />
              <LinerMemoDialog
                onSubmit={(input) => {
                  const next = appendLinerMemoEntry(body, input);
                  setBody(next);
                  change({ body: next });
                  return null;
                }}
              />
              <ArchivePaperButton paperId={paper.id} archived={Boolean(paper.archivedAt)} />
              <DeletePaperButton paperId={paper.id} title={paper.title} />
              <Button variant="primary" size="sm" onClick={saveNow} className="ml-1">
                저장
              </Button>
            </>
          }
        />
        {paper.archivedAt ? (
          <p className="rounded-lg bg-subtle px-3 py-2 text-[13px] text-muted">
            보관된 논문입니다. 목록과 홈에는 보이지 않습니다.
          </p>
        ) : null}
        {error || tagsError ? (
          <p role="alert" className="rounded-lg bg-tone-red-bg px-3 py-2 text-sm text-tone-red-fg">
            {error ?? tagsError}
          </p>
        ) : null}
        <TitleInput
          id="paper-title"
          name={undefined}
          required={false}
          value={title}
          onChange={(e) => {
            const value = e.target.value;
            setTitle(value);
            // An empty title would be rejected and hold back the other fields.
            setTitleEmpty(!value.trim());
            if (value.trim()) change({ title: value });
          }}
          aria-invalid={titleEmpty || undefined}
          aria-describedby={titleEmpty ? "paper-title-hint" : undefined}
        />
        {titleEmpty ? (
          <p id="paper-title-hint" className="-mt-2 text-xs text-danger">
            제목을 입력하세요. 비어 있는 동안 제목은 저장되지 않습니다.
          </p>
        ) : null}
        <WikiRenamePrompt item={{ type: "paper", id: paperId }} title={title} />
      </div>

      <FillFromLink
        onFill={(meta) => {
          const f = metadataToFields(meta);
          setTitle(f.title);
          setTitleEmpty(false);
          setFilled((prev) => ({ ...prev, ...f }));
          setFillVersion((v) => v + 1);
          change(f);
        }}
      />

      <Properties>
        <Property label="저자" htmlFor="paper-authors">
          <AuthorsField
            key={`authors-${fillVersion}`}
            id="paper-authors"
            defaultValue={current.authors}
            onCommit={(authors) => {
              if (authors.join("\n") !== (queue.pending().authors ?? paper.authors).join("\n")) {
                change({ authors });
              }
            }}
          />
        </Property>
        <TextField
          key={`year-${fillVersion}`}
          id="paper-year"
          label="연도"
          defaultValue={current.year}
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
          key={`venue-${fillVersion}`}
          id="paper-venue"
          label="학술지·학회"
          defaultValue={current.venue}
          onChange={(venue) => change({ venue })}
        />
        <TextField
          key={`doi-${fillVersion}`}
          id="paper-doi"
          label="DOI"
          defaultValue={current.doi}
          placeholder="10.xxxx/xxxxx"
          onChange={(doi) => change({ doi })}
        />
        <TextField
          key={`url-${fillVersion}`}
          id="paper-url"
          label="링크"
          defaultValue={current.url}
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
        <Property label="읽기 상태" htmlFor="paper-status">
          <EnumSelect
            id="paper-status"
            options={READ_STATUS.options}
            defaultValue={paper.readStatus}
            onChange={(value) => value && change({ readStatus: value })}
            className="w-auto"
          />
        </Property>
        <Property label="중요도" htmlFor="paper-importance">
          <EnumSelect
            id="paper-importance"
            options={IMPORTANCE.options}
            defaultValue={paper.importance}
            onChange={(value) => value && change({ importance: value })}
            className="w-auto"
          />
        </Property>
        <TextField
          id="paper-summary"
          label="한 줄 요약"
          defaultValue={paper.summary}
          onChange={(summary) => change({ summary })}
        />
        <Property label="태그" htmlFor="paper-tags">
          <TagInput
            id="paper-tags"
            defaultValue={paper.tags}
            suggestions={tagSuggestions}
            onChange={(names) => void saveTags(names)}
          />
        </Property>
      </Properties>

      {pdfSlot}

      <DetailBody>
        <div
          ref={bodyRef}
          onKeyDownCapture={touchBody}
          onPointerDownCapture={touchBody}
          onPasteCapture={touchBody}
          onDropCapture={touchBody}
        >
          <MarkdownEditor
            value={body}
            onChange={(markdown) => {
              setBody(markdown);
              if (bodyTouched.current) change({ body: markdown });
            }}
          />
        </div>
      </DetailBody>
    </div>
  );
}

/** Fields as stored on the server, in the editor's patch shape. */
function serverValues(paper: Paper): PatchInput {
  return {
    title: paper.title,
    authors: paper.authors,
    year: paper.year?.toString() ?? "",
    venue: paper.venue,
    doi: paper.doi,
    url: paper.url,
    readStatus: paper.readStatus,
    importance: paper.importance,
    summary: paper.summary,
    body: paper.body,
  };
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
    <Property label={label} htmlFor={id}>
      <div className={cn("flex items-center gap-1.5", className)}>
        <Input
          id={id}
          defaultValue={defaultValue}
          placeholder={placeholder}
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {after}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </Property>
  );
}
