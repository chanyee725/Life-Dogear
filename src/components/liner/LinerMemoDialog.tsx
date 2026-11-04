"use client";

import { useId, useState } from "react";
import { Button, Dialog, Field, Input, Select, Textarea } from "@/components/ui";
import {
  LINER_MEMO_INPUT_MESSAGES,
  LINER_MEMO_KIND_LABEL,
  LINER_MEMO_KINDS,
  MAX_LINER_MEMO_TEXT,
  validateLinerMemoInput,
  type LinerMemoKind,
} from "@/lib/liner";

export type LinerMemoSubmit = (input: {
  kind: LinerMemoKind;
  text: string;
  sourceUrl?: string;
}) => Promise<string | null> | string | null;

export type LinerMemoDialogProps = {
  /**
   * Saves the memo; resolve with an error message to keep the dialog open, or null
   * on success. Inside the paper editor, append to the editor's body (see
   * `appendLinerMemoEntry`) so autosave does not overwrite it; elsewhere use
   * `serverLinerMemoSubmit`.
   */
  onSubmit: LinerMemoSubmit;
  /** Trigger button label (also the accessible name). */
  label?: string;
  /**
   * Label shown below the `lg` breakpoint, where the paper header gets crowded
   * (archive, delete and save sit next to it). Defaults to "라이너 메모".
   */
  shortLabel?: string;
};

const DEFAULT_LABEL = "라이너 메모 붙여넣기";

/** "라이너 메모 붙여넣기" button + dialog: kind, pasted text, optional source link. */
export function LinerMemoDialog({
  onSubmit,
  label = DEFAULT_LABEL,
  shortLabel = label === DEFAULT_LABEL ? "라이너 메모" : label,
}: LinerMemoDialogProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<LinerMemoKind>("answer");
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  async function save() {
    const problem = validateLinerMemoInput({ kind, text, sourceUrl });
    if (problem) {
      setError(LINER_MEMO_INPUT_MESSAGES[problem]);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const failure = await onSubmit({ kind, text, sourceUrl: sourceUrl.trim() || undefined });
      if (failure) {
        setError(failure);
        return;
      }
      setText("");
      setSourceUrl("");
      setOpen(false);
    } catch {
      setError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
      >
        <span className="hidden lg:inline">{label}</span>
        <span className="lg:hidden">{shortLabel}</span>
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="라이너 메모 붙여넣기"
        className="w-[min(36rem,calc(100vw-2rem))]"
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={pending}>
              취소
            </Button>
            <Button variant="primary" onClick={save} disabled={pending || !text.trim()}>
              {pending ? "저장 중…" : "추가"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="종류" htmlFor={`${id}-kind`}>
            <Select
              id={`${id}-kind`}
              value={kind}
              onChange={(e) => setKind(e.target.value as LinerMemoKind)}
            >
              {LINER_MEMO_KINDS.map((k) => (
                <option key={k} value={k}>
                  {LINER_MEMO_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="내용" htmlFor={`${id}-text`}>
            <Textarea
              id={`${id}-text`}
              rows={8}
              value={text}
              maxLength={MAX_LINER_MEMO_TEXT}
              placeholder="라이너에서 복사한 내용"
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="출처 링크 (선택)" htmlFor={`${id}-source`}>
            <Input
              id={`${id}-source`}
              type="url"
              value={sourceUrl}
              placeholder="https://liner.com/…"
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
