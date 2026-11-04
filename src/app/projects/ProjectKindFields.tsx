"use client";

import { useState } from "react";
import { EnumSelect } from "@/components/fields/EnumSelect";
import { Property } from "@/components/fields/Properties";
import {
  PROJECT_KIND,
  PROJECT_STAGE,
  PROJECT_STATUS,
  type ProjectKind,
  type ProjectStage,
  type ProjectStatus,
} from "@/lib/enums";

/**
 * 종류 + its progress field: research projects move through stages (단계),
 * general projects only have a status (상태). Switching the kind swaps the field.
 * With `onKindChange` the kind is controlled by the parent (new project: the template
 * picker sets it too).
 */
export function ProjectKindFields({
  kind: initialKind,
  stage,
  status,
  onKindChange,
}: {
  kind: ProjectKind;
  stage: ProjectStage;
  status: ProjectStatus;
  onKindChange?: (kind: ProjectKind) => void;
}) {
  const [ownKind, setOwnKind] = useState<ProjectKind>(initialKind);
  const kind = onKindChange ? initialKind : ownKind;
  return (
    <>
      <Property label="종류" htmlFor="project-kind">
        <EnumSelect
          id="project-kind"
          name="kind"
          options={PROJECT_KIND.options}
          {...(onKindChange ? { value: kind } : { defaultValue: initialKind })}
          onChange={(value) => {
            if (value) (onKindChange ?? setOwnKind)(value);
          }}
          className="w-auto"
        />
      </Property>
      {kind === "research" ? (
        <Property label="단계" htmlFor="project-stage">
          <EnumSelect
            id="project-stage"
            name="stage"
            options={PROJECT_STAGE.options}
            defaultValue={stage}
            className="w-auto"
          />
        </Property>
      ) : (
        <Property label="상태" htmlFor="project-status">
          <EnumSelect
            id="project-status"
            name="status"
            options={PROJECT_STATUS.options}
            defaultValue={status}
            className="w-auto"
          />
        </Property>
      )}
    </>
  );
}
