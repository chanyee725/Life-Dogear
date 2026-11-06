"use client";

import { ChevronRight, Circle, CircleCheck, CircleDot, Diamond } from "lucide-react";
import { type CSSProperties, type KeyboardEventHandler, type Ref } from "react";
import type { CollapsedSet } from "./collapse";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  ratio,
  stageStatus,
  type LearningRoadmap,
  type RoadmapNode,
  type Status,
} from "./model";

export interface RoadmapTreeProps {
  roadmap: LearningRoadmap;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Folded stage/item ids; owned by RoadmapView (useTreeCollapse). */
  collapsed: CollapsedSet;
  onToggle: (id: string) => void;
  /** Keyboard wiring for ul.rt-tree (useTreeKeyboard). */
  treeRef?: Ref<HTMLUListElement>;
  onKeyDown?: KeyboardEventHandler<HTMLUListElement>;
}

/*
 * DOM contract (keyboard handling lives with the collapse hook, keyed by data-id):
 *   ul.rt-tree[role=tree]
 *     li.rt-node[role=treeitem][aria-level][aria-expanded?][aria-selected][data-id][data-kind]
 *       div.rt-row > button.rt-twisty + (stage: button.rt-stage-label | item: button.rt-label)
 *       ul.rt-group[role=group] > li.rt-node ...
 */

const STATUS_ICON: Record<Status, typeof Circle> = {
  todo: Circle,
  doing: CircleDot,
  done: CircleCheck,
};

function StatusIcon({ status }: { status: Status }) {
  const Icon = STATUS_ICON[status];
  return <Icon className="rt-status" aria-hidden="true" strokeWidth={2.25} />;
}

function Twisty({ node, onToggle }: { node: RoadmapNode; onToggle: (id: string) => void }) {
  if (node.children.length === 0)
    return <span className="rt-twisty rt-twisty-leaf" aria-hidden="true" />;
  return (
    <button
      type="button"
      className="rt-twisty"
      tabIndex={-1}
      aria-hidden="true"
      data-testid={`rt-toggle-${node.id}`}
      onClick={() => onToggle(node.id)}
    >
      <ChevronRight className="rt-chevron" strokeWidth={2.25} />
    </button>
  );
}

interface BranchProps {
  collapsed: CollapsedSet;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function ItemNode({ node, level, ...ctx }: BranchProps & { node: RoadmapNode; level: number }) {
  const hasChildren = node.children.length > 0;
  const folded = isFolded(ctx, node);
  const priority = node.priority ? PRIORITY_LABEL[node.priority] : null;
  const meta = [priority, STATUS_LABEL[node.status]].filter(Boolean).join(", ");
  return (
    <li
      className="rt-node"
      role="treeitem"
      tabIndex={-1}
      aria-level={level}
      aria-expanded={hasChildren ? !folded : undefined}
      aria-selected={ctx.selectedId === node.id}
      data-id={node.id}
      data-kind="item"
      data-depth={level}
      data-priority={node.priority ?? undefined}
      data-status={node.status}
    >
      <div className="rt-row">
        <Twisty node={node} onToggle={ctx.onToggle} />
        <button
          type="button"
          className="rt-label"
          tabIndex={-1}
          data-testid={`rm-item-${node.id}`}
          title={meta.replace(", ", " · ")}
          onClick={() => ctx.onSelect(node.id)}
        >
          <StatusIcon status={node.status} />
          {node.priority === "essential" && (
            <Diamond className="rt-prio" aria-hidden="true" strokeWidth={2.25} />
          )}
          <span className="rt-title">{node.title}</span>
          <span className="sr-only">({meta})</span>
        </button>
        {hasChildren && (
          <span className="rt-count" aria-hidden="true">
            {node.progress.done}/{node.progress.total}
          </span>
        )}
      </div>
      {hasChildren && !folded && (
        <ul className="rt-group" role="group">
          {node.children.map((c) => (
            <ItemNode key={c.id} node={c} level={level + 1} {...ctx} />
          ))}
        </ul>
      )}
    </li>
  );
}

const isFolded = (ctx: BranchProps, node: RoadmapNode) => ctx.collapsed.has(node.id);

function StageNode({ stage, index, ...ctx }: BranchProps & { stage: RoadmapNode; index: number }) {
  const folded = isFolded(ctx, stage);
  const hasChildren = stage.children.length > 0;
  const status = stageStatus(stage);
  const { done, total } = stage.progress;
  return (
    <li
      className="rt-node rt-stage"
      role="treeitem"
      tabIndex={index === 0 ? 0 : -1}
      aria-level={1}
      aria-expanded={hasChildren ? !folded : undefined}
      aria-selected={false}
      aria-label={`${index + 1}단계 ${stage.title}, ${done}/${total} 완료`}
      data-id={stage.id}
      data-kind="stage"
      data-depth={1}
      data-status={status}
      data-testid={`rm-stage-${stage.id}`}
      style={{ "--rt-progress": ratio(stage.progress) } as CSSProperties}
    >
      <div className="rt-row rt-stage-row">
        <span className="rt-stage-num" aria-hidden="true">
          {status === "done" ? <CircleCheck strokeWidth={2.5} /> : index + 1}
        </span>
        <button
          type="button"
          className="rt-stage-label"
          tabIndex={-1}
          onClick={() => hasChildren && ctx.onToggle(stage.id)}
        >
          <span className="rt-stage-title">{stage.title}</span>
          {hasChildren && (
            <ChevronRight className="rt-chevron" aria-hidden="true" strokeWidth={2.25} />
          )}
        </button>
        <span className="rt-stage-meter" aria-hidden="true">
          <span className="rt-stage-bar" />
          <span className="rt-stage-count">
            {done}/{total}
          </span>
        </span>
        {stage.description && !folded && <p className="rt-stage-desc">{stage.description}</p>}
      </div>
      {hasChildren && !folded && (
        <ul className="rt-group" role="group">
          {stage.children.map((c) => (
            <ItemNode key={c.id} node={c} level={2} {...ctx} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Stages down a trunk; items branch off with elbow connectors, deeper levels indent further. */
export default function RoadmapTree({
  roadmap,
  selectedId,
  onSelect,
  treeRef,
  onKeyDown,
  collapsed,
  onToggle,
}: RoadmapTreeProps) {
  const ctx: BranchProps = {
    collapsed,
    onToggle,
    selectedId,
    onSelect,
  };

  return (
    <ul
      ref={treeRef}
      onKeyDown={onKeyDown}
      className="rt-tree"
      role="tree"
      aria-label={`${roadmap.title} 로드맵`}
      data-testid="rm-tree"
    >
      {roadmap.stages.map((stage, i) => (
        <StageNode key={stage.id} stage={stage} index={i} {...ctx} />
      ))}
    </ul>
  );
}
