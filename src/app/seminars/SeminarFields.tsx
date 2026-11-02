import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { DateField } from "@/components/fields/DateField";
import { EnumSelect } from "@/components/fields/EnumSelect";
import { DetailBody, TitleInput } from "@/components/fields/ItemDetail";
import { Properties, Property } from "@/components/fields/Properties";
import { TagInput } from "@/components/fields/TagInput";
import { Input } from "@/components/ui/Input";
import { SEMINAR_KIND } from "@/lib/enums";
import type { SeminarInput } from "@/lib/repo/seminars";

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
        <Property label="종류" htmlFor="seminar-kind">
          <EnumSelect
            id="seminar-kind"
            name="kind"
            options={SEMINAR_KIND.options}
            defaultValue={values.kind}
            className="w-auto"
          />
        </Property>
        <Property label="연사" htmlFor="seminar-speaker">
          <Input id="seminar-speaker" name="speaker" defaultValue={values.speaker} />
        </Property>
        <Property label="주최·장소" htmlFor="seminar-host">
          <Input id="seminar-host" name="hostVenue" defaultValue={values.hostVenue} />
        </Property>
        <Property label="핵심 한 줄" htmlFor="seminar-keyline">
          <Input
            id="seminar-keyline"
            name="keyLine"
            defaultValue={values.keyLine}
            placeholder="이 발표에서 남길 한 문장"
          />
        </Property>
        <Property label="자료 링크" htmlFor="seminar-material">
          <Input
            id="seminar-material"
            name="materialUrl"
            inputMode="url"
            defaultValue={values.materialUrl}
            placeholder="https://"
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
