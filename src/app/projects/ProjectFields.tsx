import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { DateField } from "@/components/fields/DateField";
import { EnumSelect } from "@/components/fields/EnumSelect";
import { DetailBody, TitleInput } from "@/components/fields/ItemDetail";
import { Properties, Property } from "@/components/fields/Properties";
import { TagInput } from "@/components/fields/TagInput";
import { Input } from "@/components/ui/Input";
import type { ProjectKind, ProjectStage, ProjectStatus } from "@/lib/enums";
import { ProjectKindFields } from "./ProjectKindFields";

export type ProjectFormValues = {
  title: string;
  kind: ProjectKind;
  stage: ProjectStage;
  status: ProjectStatus;
  areaId: string | null;
  goalId: string | null;
  nextAction: string;
  researchQuestion: string;
  startDate: string | null;
  dueDate: string | null;
  body: string;
  tags: string[];
};

/** Fields shared by the new and detail pages. `editorKey` remounts the editor per item. */
export function ProjectFields({
  values,
  tagSuggestions,
  areaOptions,
  goalOptions,
  editorKey,
  onKindChange,
}: {
  values: ProjectFormValues;
  tagSuggestions: string[];
  /** Non-archived areas (plus the current one if it is archived). */
  areaOptions: { value: string; label: string }[];
  /** Non-archived goals (plus the current one if it is archived). */
  goalOptions: { value: string; label: string }[];
  editorKey: string;
  /** Makes 종류 controlled by the parent (`values.kind` is then the current value). */
  onKindChange?: (kind: ProjectKind) => void;
}) {
  return (
    <>
      <TitleInput defaultValue={values.title} />
      <Properties>
        <ProjectKindFields
          kind={values.kind}
          stage={values.stage}
          status={values.status}
          onKindChange={onKindChange}
        />
        {/* No longer shown; kept hidden so saving leaves the stored value alone. */}
        <input type="hidden" name="nextAction" value={values.nextAction} />
        <Property label="영역 · 목표" htmlFor="project-area">
          <div className="flex flex-wrap items-center gap-2">
            <EnumSelect
              id="project-area"
              name="areaId"
              aria-label="영역"
              options={areaOptions}
              emptyLabel="영역 없음"
              defaultValue={values.areaId ?? ""}
              className="w-auto"
            />
            <EnumSelect
              id="project-goal"
              name="goalId"
              aria-label="목표"
              options={goalOptions}
              emptyLabel="목표 없음"
              defaultValue={values.goalId ?? ""}
              className="w-auto max-w-full"
            />
          </div>
        </Property>
        {values.kind === "research" ? (
          <Property label="연구 질문" htmlFor="project-question">
            <Input
              id="project-question"
              name="researchQuestion"
              defaultValue={values.researchQuestion}
              placeholder="무엇을 밝히고 싶은가?"
            />
          </Property>
        ) : (
          <input type="hidden" name="researchQuestion" value={values.researchQuestion} />
        )}
        <Property label="기간" htmlFor="project-start">
          <div className="flex flex-wrap items-center gap-2">
            <DateField
              id="project-start"
              name="startDate"
              aria-label="시작일"
              defaultValue={values.startDate}
            />
            <span aria-hidden className="text-muted">
              ~
            </span>
            <DateField
              id="project-due"
              name="dueDate"
              aria-label="마감일"
              defaultValue={values.dueDate}
            />
          </div>
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

/** Area select options; keeps the current area visible even if it was archived. */
export function areaOptionsFor(
  areas: readonly { id: string; title: string; archivedAt?: string | null }[],
  current: string | null,
): { value: string; label: string }[] {
  return areas
    .filter((a) => !a.archivedAt || a.id === current)
    .map((a) => ({ value: a.id, label: a.archivedAt ? `${a.title} (보관됨)` : a.title }));
}
