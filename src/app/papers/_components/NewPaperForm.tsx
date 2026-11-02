"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { safeAction } from "@/components/links/safe-action";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { EnumSelect } from "@/components/fields/EnumSelect";
import { TagInput } from "@/components/fields/TagInput";
import { Button, buttonClass, Field, Input } from "@/components/ui";
import { IMPORTANCE, READ_STATUS } from "@/lib/enums";
import { TEMPLATES } from "@/lib/templates";
import { createPaper } from "../actions";
import { AuthorsField } from "./AuthorsField";

export function NewPaperForm({ tagSuggestions }: { tagSuggestions: string[] }) {
  // safeAction turns a crashed or unreachable action into an inline error (redirects pass through).
  const [state, action, pending] = useActionState(
    (previous: Awaited<ReturnType<typeof createPaper>> | null, form: FormData) =>
      safeAction(() => createPaper(previous, form)),
    null,
  );

  return (
    <form
      // Submitting manually (not `action={...}`) keeps the fields when saving fails:
      // React resets uncontrolled forms after a form action.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-8"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="제목" htmlFor="paper-title" className="sm:col-span-2">
          <Input id="paper-title" name="title" required autoFocus maxLength={300} />
        </Field>
        <Field label="저자" htmlFor="paper-authors" className="sm:col-span-2">
          <AuthorsField id="paper-authors" name="authors" />
        </Field>
        <Field label="연도" htmlFor="paper-year">
          <Input
            id="paper-year"
            name="year"
            inputMode="numeric"
            pattern="\d{4}"
            placeholder="2024"
          />
        </Field>
        <Field label="학술지·학회" htmlFor="paper-venue">
          <Input id="paper-venue" name="venue" />
        </Field>
        <Field label="DOI" htmlFor="paper-doi">
          <Input id="paper-doi" name="doi" placeholder="10.xxxx/xxxxx" />
        </Field>
        <Field label="링크" htmlFor="paper-url">
          <Input id="paper-url" name="url" type="url" placeholder="https://" />
        </Field>
        <Field label="읽기 상태" htmlFor="paper-status">
          <EnumSelect
            id="paper-status"
            name="readStatus"
            options={READ_STATUS.options}
            defaultValue="to_read"
          />
        </Field>
        <Field label="중요도" htmlFor="paper-importance">
          <EnumSelect
            id="paper-importance"
            name="importance"
            options={IMPORTANCE.options}
            defaultValue="reference"
          />
        </Field>
        <Field label="한 줄 요약" htmlFor="paper-summary" className="sm:col-span-2">
          <Input id="paper-summary" name="summary" />
        </Field>
        <Field label="태그" htmlFor="paper-tags" className="sm:col-span-2">
          <TagInput id="paper-tags" name="tags" suggestions={tagSuggestions} />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-[13px] font-medium text-muted">본문</h2>
        <MarkdownEditor name="body" value={TEMPLATES.paper} />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
        {state && !state.ok ? (
          <p role="alert" className="mr-auto text-sm text-danger">
            {state.error}
          </p>
        ) : null}
        <Link href="/papers" className={buttonClass("ghost")}>
          취소
        </Link>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </form>
  );
}
