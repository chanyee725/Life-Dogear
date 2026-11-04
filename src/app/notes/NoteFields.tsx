import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { EnumSelect } from "@/components/fields/EnumSelect";
import { DetailBody, TitleInput } from "@/components/fields/ItemDetail";
import { Properties, Property } from "@/components/fields/Properties";
import { TagInput } from "@/components/fields/TagInput";
import { buttonClass } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NOTE_SOURCE_KIND, type NoteSourceKind } from "@/lib/enums";
import { isHttpUrl } from "./source";

export type NoteFormValues = {
  title: string;
  sourceKind: NoteSourceKind | null;
  sourceTitle: string;
  sourceUrl: string;
  areaId: string | null;
  body: string;
  tags: string[];
};

/** Fields shared by the new and detail pages. `editorKey` remounts the editor per item. */
export function NoteFields({
  values,
  tagSuggestions,
  areaOptions,
  editorKey,
}: {
  values: NoteFormValues;
  tagSuggestions: string[];
  /** Non-archived areas (plus the current one if it is archived). */
  areaOptions: { value: string; label: string }[];
  editorKey: string;
}) {
  return (
    <>
      <TitleInput defaultValue={values.title} />
      <Properties>
        <Property label="출처 종류" htmlFor="note-source-kind">
          <EnumSelect
            id="note-source-kind"
            name="sourceKind"
            options={NOTE_SOURCE_KIND.options}
            emptyLabel="없음"
            defaultValue={values.sourceKind ?? ""}
            className="w-auto"
          />
        </Property>
        <Property label="출처 이름" htmlFor="note-source-title">
          <Input
            id="note-source-title"
            name="sourceTitle"
            defaultValue={values.sourceTitle}
            placeholder="책 제목, 강의 이름…"
          />
        </Property>
        <Property label="출처 링크" htmlFor="note-source-url">
          <div className="flex items-center gap-2">
            <Input
              id="note-source-url"
              name="sourceUrl"
              type="url"
              defaultValue={values.sourceUrl}
              placeholder="https://"
            />
            {isHttpUrl(values.sourceUrl) ? (
              <a
                href={values.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("ghost", "sm")}
              >
                열기 ↗
              </a>
            ) : null}
          </div>
        </Property>
        <Property label="영역" htmlFor="note-area">
          <EnumSelect
            id="note-area"
            name="areaId"
            options={areaOptions}
            emptyLabel="없음"
            defaultValue={values.areaId ?? ""}
            className="w-auto"
          />
        </Property>
        <Property label="태그" htmlFor="note-tags">
          <TagInput
            id="note-tags"
            name="tags"
            defaultValue={values.tags}
            suggestions={tagSuggestions}
          />
        </Property>
      </Properties>
      <DetailBody>
        <MarkdownEditor
          key={editorKey}
          name="body"
          value={values.body}
          placeholder="공부한 내용을 정리해 보세요…"
        />
      </DetailBody>
    </>
  );
}
