import type { ItemRef } from "@/lib/repo/shared";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { DetailBody, TitleInput } from "@/components/fields/ItemDetail";
import { Properties, Property } from "@/components/fields/Properties";
import { TagInput } from "@/components/fields/TagInput";
import { Input } from "@/components/ui/Input";

export type AreaFormValues = { title: string; standard: string; body: string; tags: string[] };

export function AreaFields({
  values,
  tagSuggestions,
  editorKey,
  doc,
}: {
  values: AreaFormValues;
  tagSuggestions: string[];
  editorKey: string;
  /** The saved item this body belongs to (detail page); omit on the new page. */
  doc?: ItemRef | null;
}) {
  return (
    <>
      <TitleInput defaultValue={values.title} placeholder="영역 이름" />
      <Properties>
        <Property label="유지 기준" htmlFor="area-standard">
          <Input
            id="area-standard"
            name="standard"
            defaultValue={values.standard}
            placeholder="이 영역에서 지키고 싶은 기준"
          />
        </Property>
        <Property label="태그" htmlFor="area-tags">
          <TagInput
            id="area-tags"
            name="tags"
            defaultValue={values.tags}
            suggestions={tagSuggestions}
          />
        </Property>
      </Properties>
      <DetailBody>
        <MarkdownEditor
          key={editorKey}
          doc={doc}
          name="body"
          value={values.body}
          placeholder="이 영역에 대한 메모…"
        />
      </DetailBody>
    </>
  );
}
