import { DateField } from "@/components/fields/DateField";
import { EnumSelect } from "@/components/fields/EnumSelect";
import { DetailBody, TitleInput } from "@/components/fields/ItemDetail";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { Properties, Property } from "@/components/fields/Properties";
import { TagInput } from "@/components/fields/TagInput";
import { Input } from "@/components/ui/Input";
import { PROJECT_STAGE } from "@/lib/enums";
import type { ProjectInput } from "@/lib/repo/projects";

export type ProjectFormValues = Required<Omit<ProjectInput, "startDate" | "dueDate">> & {
  startDate: string | null;
  dueDate: string | null;
};

/** Fields shared by the new and detail pages. `editorKey` remounts the editor per item. */
export function ProjectFields({
  values,
  tagSuggestions,
  editorKey,
}: {
  values: ProjectFormValues;
  tagSuggestions: string[];
  editorKey: string;
}) {
  return (
    <>
      <TitleInput defaultValue={values.title} />
      <Properties>
        <Property label="연구 질문" htmlFor="project-question">
          <Input
            id="project-question"
            name="researchQuestion"
            defaultValue={values.researchQuestion}
            placeholder="무엇을 밝히고 싶은가?"
          />
        </Property>
        <Property label="단계" htmlFor="project-stage">
          <EnumSelect
            id="project-stage"
            name="stage"
            options={PROJECT_STAGE.options}
            defaultValue={values.stage}
            className="w-auto"
          />
        </Property>
        <Property label="시작일" htmlFor="project-start">
          <DateField id="project-start" name="startDate" defaultValue={values.startDate} />
        </Property>
        <Property label="마감일" htmlFor="project-due">
          <DateField id="project-due" name="dueDate" defaultValue={values.dueDate} />
        </Property>
        <Property label="태그" htmlFor="project-tags">
          <TagInput
            id="project-tags"
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
