"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "@/components/ui/cn";
import { collapseAll, expandAll, toggleCollapsed, type CollapsedSet } from "./collapse";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  progressOf,
  ratio,
  splitSides,
  stageStatus,
  type LearningRoadmap,
  type Progress,
  type RoadmapItem,
  type RoadmapStage,
} from "./model";

type Side = "left" | "right";

export interface RoadmapTreeProps {
  roadmap: LearningRoadmap;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function ProgressBar({ progress, label }: { progress: Progress; label: string }) {
  return (
    <div
      className="rm-progress flex items-center gap-2"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-valuenow={progress.done}
      style={{ "--rm-progress": ratio(progress) } as CSSProperties}
    >
      <span className="rm-progress-bar block h-1.5 flex-1" />
      <span className="rm-progress-text text-xs tabular-nums">
        {progress.done}/{progress.total}
      </span>
    </div>
  );
}

function ItemButton({
  item,
  depth,
  selected,
  onSelect,
}: {
  item: RoadmapItem;
  depth: 1 | 2;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className="rm-item flex min-w-0 items-center gap-2 text-left"
      data-testid={`rm-item-${item.id}`}
      data-priority={item.priority}
      data-status={item.status}
      data-depth={depth}
      aria-pressed={selected}
      title={`${PRIORITY_LABEL[item.priority]} · ${STATUS_LABEL[item.status]}`}
      onClick={() => onSelect(item.id)}
    >
      <span className="rm-item-status shrink-0" aria-hidden="true" />
      <span className="rm-item-title min-w-0 break-words">{item.title}</span>
      <span className="sr-only">
        ({PRIORITY_LABEL[item.priority]}, {STATUS_LABEL[item.status]})
      </span>
    </button>
  );
}

/** One item plus its children, which sit further from the stem (outward). */
function Branch({
  item,
  side,
  collapsed,
  onToggle,
  selectedId,
  onSelect,
}: {
  item: RoadmapItem;
  side: Side;
  collapsed: CollapsedSet;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const hasChildren = item.children.length > 0;
  const folded = collapsed.has(item.id);
  return (
    <div
      className={cn(
        "rm-branch flex items-start gap-3",
        side === "left" ? "lg:flex-row-reverse" : "lg:flex-row",
        "max-lg:flex-col max-lg:gap-1.5",
      )}
      data-side={side}
    >
      <div className={cn("flex items-center gap-1", side === "left" && "lg:flex-row-reverse")}>
        <ItemButton
          item={item}
          depth={1}
          selected={selectedId === item.id}
          onSelect={onSelect}
        />
        {hasChildren && (
          <button
            type="button"
            className="rm-toggle shrink-0 px-1 text-xs"
            data-testid={`rm-toggle-${item.id}`}
            aria-expanded={!folded}
            aria-label={folded ? `${item.title} 펼치기` : `${item.title} 접기`}
            onClick={() => onToggle(item.id)}
          >
            {folded ? `+${item.children.length}` : "−"}
          </button>
        )}
      </div>
      {hasChildren && !folded && (
        <div
          className={cn(
            "rm-children flex flex-col gap-1.5",
            side === "left" ? "lg:items-end" : "lg:items-start",
            "max-lg:pl-6",
          )}
        >
          {item.children.map((c) => (
            <ItemButton
              key={c.id}
              item={c}
              depth={2}
              selected={selectedId === c.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StageRow({
  stage,
  index,
  collapsed,
  onToggle,
  selectedId,
  onSelect,
}: {
  stage: RoadmapStage;
  index: number;
  collapsed: CollapsedSet;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const folded = collapsed.has(stage.id);
  const { left, right } = splitSides(stage.items);
  const progress = progressOf(stage.items);
  const side = (items: RoadmapItem[], s: Side) => (
    <div
      className={cn(
        "rm-side flex flex-col gap-3",
        s === "left" ? "lg:items-end" : "lg:items-start",
        "max-lg:pl-6",
      )}
      data-side={s}
    >
      {items.map((item) => (
        <Branch
          key={item.id}
          item={item}
          side={s}
          collapsed={collapsed}
          onToggle={onToggle}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );

  return (
    <section
      className={cn(
        "rm-stage relative grid items-center gap-x-8 gap-y-3",
        "lg:grid-cols-[minmax(0,1fr)_16rem_minmax(0,1fr)]",
        "max-lg:grid-cols-1",
      )}
      data-testid={`rm-stage-${stage.id}`}
      data-status={stageStatus(stage.items)}
      aria-label={`${index + 1}단계 ${stage.title}`}
    >
      {!folded && <div className="max-lg:order-2">{side(left, "left")}</div>}
      <div
        className={cn(
          "rm-stage-node relative z-10 flex flex-col gap-2 lg:col-start-2 max-lg:order-1",
        )}
      >
        <button
          type="button"
          className="flex items-baseline gap-2 text-left"
          aria-expanded={!folded}
          data-testid={`rm-stage-toggle-${stage.id}`}
          onClick={() => onToggle(stage.id)}
        >
          <span className="rm-stage-index tabular-nums">{String(index + 1).padStart(2, "0")}</span>
          <span className="rm-stage-title min-w-0 break-words">{stage.title}</span>
        </button>
        {stage.description && <p className="rm-desc text-xs">{stage.description}</p>}
        <ProgressBar progress={progress} label={`${stage.title} 진행률`} />
      </div>
      {!folded && (
        <div className="lg:col-start-3 max-lg:order-3">{side(right, "right")}</div>
      )}
    </section>
  );
}

/** Stages down a central stem; each stage's items branch left and right, children outward. */
export default function RoadmapTree({ roadmap, selectedId, onSelect }: RoadmapTreeProps) {
  const [collapsed, setCollapsed] = useState<CollapsedSet>(expandAll);
  const onToggle = (id: string) => setCollapsed((c) => toggleCollapsed(c, id));
  const stageIds = roadmap.stages.map((s) => s.id);
  const allFolded = stageIds.length > 0 && stageIds.every((id) => collapsed.has(id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          className="rm-toggle text-xs"
          onClick={() => setCollapsed(allFolded ? expandAll() : collapseAll(stageIds))}
        >
          {allFolded ? "모두 펼치기" : "모두 접기"}
        </button>
      </div>
      <div className="rm-tree relative flex flex-col gap-10 py-4" data-testid="rm-tree">
        {roadmap.stages.map((stage, i) => (
          <StageRow
            key={stage.id}
            stage={stage}
            index={i}
            collapsed={collapsed}
            onToggle={onToggle}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
