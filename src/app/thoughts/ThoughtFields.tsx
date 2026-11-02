import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { EnumSelect } from "@/components/fields/EnumSelect";
import { DetailBody, TitleInput } from "@/components/fields/ItemDetail";
import { Properties, Property } from "@/components/fields/Properties";
import { TagInput } from "@/components/fields/TagInput";
import { THOUGHT_KIND, THOUGHT_MATURITY } from "@/lib/enums";
import type { ThoughtInput } from "@/lib/repo/thoughts";

export type ThoughtFormValues = Required<ThoughtInput>;

export function ThoughtFields({
  values,
  tagSuggestions,
  editorKey,
}: {
  values: ThoughtFormValues;
  tagSuggestions: string[];
  editorKey: string;
}) {
  return (
    <>
      <TitleInput defaultValue={values.title} />
      <Properties>
        <Property label="종류" htmlFor="thought-kind">
          <EnumSelect
            id="thought-kind"
            name="kind"
            options={THOUGHT_KIND.options}
            defaultValue={values.kind}
            className="w-auto"
          />
        </Property>
        <Property label="발전 정도" htmlFor="thought-maturity">
          <EnumSelect
            id="thought-maturity"
            name="maturity"
            options={THOUGHT_MATURITY.options}
            defaultValue={values.maturity}
            className="w-auto"
          />
        </Property>
        <Property label="태그" htmlFor="thought-tags">
          <TagInput
            id="thought-tags"
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
          placeholder="생각을 적어 보세요…"
        />
      </DetailBody>
    </>
  );
}
