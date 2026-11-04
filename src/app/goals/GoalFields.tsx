"use client";

import { useState } from "react";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { EnumSelect } from "@/components/fields/EnumSelect";
import { DetailBody, TitleInput } from "@/components/fields/ItemDetail";
import { Properties, Property } from "@/components/fields/Properties";
import { TagInput } from "@/components/fields/TagInput";
import { Input } from "@/components/ui/Input";
import {
  GOAL_HORIZON,
  GOAL_PROGRESS_MODE,
  GOAL_STATUS,
  type GoalHorizon,
  type GoalProgressMode,
  type GoalStatus,
} from "@/lib/enums";
import { splitPeriod, joinPeriod, PERIOD_HINT } from "./period";

export type GoalFormValues = {
  title: string;
  horizon: GoalHorizon;
  period: string | null;
  parentId: string | null;
  areaId: string | null;
  why: string;
  status: GoalStatus;
  progressMode: GoalProgressMode;
  manualProgress: number | null;
  body: string;
  tags: string[];
};

/** Possible parents; `horizon` filters them to the level above the edited goal. */
export type ParentOption = {
  value: string;
  label: string;
  horizon: GoalHorizon;
  period: string | null;
};

const PARENT_OF: Record<GoalHorizon, GoalHorizon | null> = {
  life: null,
  year: "life",
  quarter: "year",
};

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"].map((q) => ({ value: q, label: q }));

/**
 * Fields shared by the new and detail pages. 기간 단위 drives the rest: life goals have
 * no period or parent, year goals take a year and a life goal, quarter goals a year +
 * quarter and a year goal. The combined period goes out in one hidden `period` input.
 */
export function GoalFields({
  values,
  tagSuggestions,
  parentOptions,
  areaOptions,
  editorKey,
  hasChildren = false,
  created,
}: {
  values: GoalFormValues;
  tagSuggestions: string[];
  parentOptions: ParentOption[];
  areaOptions: { value: string; label: string }[];
  editorKey: string;
  /** Child goals pin the horizon (and a year goal's year) — the repo refuses changes. */
  hasChildren?: boolean;
  /** `YYYY.MM.DD` (Seoul) of `createdAt` — detail page only, read-only. */
  created?: string;
}) {
  const [horizon, setHorizon] = useState<GoalHorizon>(values.horizon);
  const initial = splitPeriod(values.period);
  const [year, setYear] = useState(initial.year);
  const [quarter, setQuarter] = useState(initial.quarter);
  const [parentId, setParentId] = useState(values.parentId ?? "");
  const [mode, setMode] = useState<GoalProgressMode>(values.progressMode);

  const parentHorizon = PARENT_OF[horizon];
  const parents = parentOptions.filter((p) => p.horizon === parentHorizon);
  const period = joinPeriod(horizon, year, quarter);

  return (
    <>
      <TitleInput defaultValue={values.title} placeholder="목표" />
      <Properties>
        <Property label="기간 단위 · 기간" htmlFor="goal-horizon">
          <input type="hidden" name="period" value={period} />
          <div className="flex flex-wrap items-center gap-2">
            <EnumSelect
              id="goal-horizon"
              name="horizon"
              aria-label="기간 단위"
              options={GOAL_HORIZON.options.map((o) => ({
                value: o.value,
                label: `${o.label} 목표`,
              }))}
              defaultValue={values.horizon}
              disabled={hasChildren}
              aria-describedby={hasChildren ? "goal-horizon-why" : undefined}
              onChange={(value) => {
                if (!value) return;
                setHorizon(value);
                // A parent from another level no longer fits.
                const fits = parentOptions.some(
                  (p) => p.value === parentId && p.horizon === PARENT_OF[value],
                );
                if (!fits) setParentId("");
              }}
              className="w-auto"
            />
            {horizon === "life" ? (
              <span className="text-sm text-muted">기간 없음 (방향)</span>
            ) : (
              <>
                <Input
                  id="goal-year"
                  aria-label="연도"
                  disabled={hasChildren && horizon === "year"}
                  inputMode="numeric"
                  maxLength={4}
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                  placeholder={PERIOD_HINT.year}
                  className="w-24"
                />
                {horizon === "quarter" ? (
                  <EnumSelect
                    aria-label="분기"
                    options={QUARTERS}
                    value={quarter}
                    onChange={(value) => setQuarter(value || "Q1")}
                    className="w-auto"
                  />
                ) : null}
              </>
            )}
            {hasChildren ? (
              <span id="goal-horizon-why" className="text-xs text-muted">
                하위 목표가 있어 바꿀 수 없습니다.
              </span>
            ) : null}
          </div>
        </Property>
        {parentHorizon ? (
          <Property label="상위 목표" htmlFor="goal-parent">
            <EnumSelect
              id="goal-parent"
              name="parentId"
              options={parents}
              emptyLabel="없음"
              value={parentId}
              onChange={(value) => {
                setParentId(value);
                // A quarter goal lives in its year goal's year.
                const parent = parentOptions.find((p) => p.value === value);
                if (horizon === "quarter" && parent?.period) setYear(parent.period);
              }}
              className="w-auto max-w-full"
            />
          </Property>
        ) : (
          <input type="hidden" name="parentId" value="" />
        )}
        <Property label="왜" htmlFor="goal-why">
          <Input
            id="goal-why"
            name="why"
            defaultValue={values.why}
            placeholder="이 목표가 중요한 이유"
          />
        </Property>
        <Property label="상태 · 영역" htmlFor="goal-status">
          <div className="flex flex-wrap items-center gap-2">
            <EnumSelect
              id="goal-status"
              name="status"
              aria-label="상태"
              options={GOAL_STATUS.options}
              defaultValue={values.status}
              className="w-auto"
            />
            <EnumSelect
              id="goal-area"
              name="areaId"
              aria-label="영역"
              options={areaOptions}
              emptyLabel="영역 없음"
              defaultValue={values.areaId ?? ""}
              className="w-auto max-w-full"
            />
          </div>
        </Property>
        {horizon === "life" ? null : (
          <Property label="진행률" htmlFor="goal-progress-mode">
            <div className="flex flex-wrap items-center gap-2">
              <EnumSelect
                id="goal-progress-mode"
                name="progressMode"
                options={GOAL_PROGRESS_MODE.options}
                defaultValue={values.progressMode}
                onChange={(value) => {
                  if (value) setMode(value);
                }}
                className="w-auto"
              />
              <Input
                aria-label="진행률 (%)"
                name="manualProgress"
                type="number"
                min={0}
                max={100}
                defaultValue={values.manualProgress ?? ""}
                placeholder={mode === "manual" ? "0–100" : "프로젝트가 없을 때"}
                className="w-36"
              />
              <span className="text-sm text-muted">%</span>
            </div>
          </Property>
        )}
        <Property label="태그" htmlFor="goal-tags">
          <TagInput
            id="goal-tags"
            name="tags"
            defaultValue={values.tags}
            suggestions={tagSuggestions}
          />
        </Property>
        {created ? (
          <Property label="생성일">
            <span className="text-sm tabular-nums">{created}</span>
          </Property>
        ) : null}
      </Properties>
      <DetailBody>
        <MarkdownEditor
          key={editorKey}
          name="body"
          value={values.body}
          placeholder="계획, 기준, 메모…"
        />
      </DetailBody>
    </>
  );
}
