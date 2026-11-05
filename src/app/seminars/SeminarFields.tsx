import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { DateField } from "@/components/fields/DateField";
import { DetailBody, TitleInput } from "@/components/fields/ItemDetail";
import { Properties, Property } from "@/components/fields/Properties";
import { TagInput } from "@/components/fields/TagInput";
import { Input } from "@/components/ui/Input";
import type { SeminarInput } from "@/lib/repo/seminars";
import { SeminarKindFields } from "./SeminarKindFields";

export type SeminarFormValues = Required<Omit<SeminarInput, "date">> & { date: string | null };

export function SeminarFields({
  values,
  tagSuggestions,
  editorKey,
}: {
  values: SeminarFormValues;
  tagSuggestions: string[];
  editorKey: string;
}) {
  return (
    <>
      <TitleInput defaultValue={values.title} />
      <Properties>
        <Property label="날짜" htmlFor="seminar-date">
          <DateField id="seminar-date" name="date" defaultValue={values.date} />
        </Property>
        <SeminarKindFields
          kind={values.kind}
          speaker={values.speaker}
          hostVenue={values.hostVenue}
          materialUrl={values.materialUrl}
        />
        <Property label="핵심 한 줄" htmlFor="seminar-keyline">
          <Input
            id="seminar-keyline"
            name="keyLine"
            defaultValue={values.keyLine}
            placeholder="이 활동에서 남길 한 문장"
          />
        </Property>
        <Property label="태그" htmlFor="seminar-tags">
          <TagInput
            id="seminar-tags"
            name="tags"
            defaultValue={values.tags}
            suggestions={tagSuggestions}
          />
        </Property>
      </Properties>
      <DetailBody>
        <MarkdownEditor key={editorKey} name="body" value={values.body} />
      </DetailBody>
    </>
  );
}
