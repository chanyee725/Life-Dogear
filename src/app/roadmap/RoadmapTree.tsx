"use client";

import { Check, ChevronRight } from "lucide-react";
import { useRef, type CSSProperties } from "react";
import type { CollapsedSet } from "./collapse";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  ratio,
  stageStatus,
  type LearningRoadmap,
  type Priority,
  type RoadmapNode,
  type Status,
} from "./model";
import { stageCurvePath, stageRows, type Side, type StageRow } from "./path-layout";
import { useTreeKeyboard } from "./useTreeKeyboard";
import "./roadmap-tree.css";

export interface RoadmapTreeProps {
  roadmap: LearningRoadmap;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Folded stage/item ids; owned by RoadmapView (useTreeCollapse). */
  collapsed: CollapsedSet;
  onToggle: (id: string) => void;
}

/*
 * Path layout (roadmap-tree.css): stages run down a thick curved path as yellow topic boxes;
 * each stage's items sit beside it, split into a left and a right column with dotted links.
 *
 * DOM contract (keyboard handling in useTreeKeyboard, keyed by data-id):
 *   ul.rt-tree[role=tree]
 *     li.rt-node.rt-stage[role=treeitem][aria-level=1][aria-expanded?][data-id]
 *       div.rt-row.rt-stage-row > button.rt-stage-label
 *       ul.rt-group.rt-side[data-side=left|right][role=group] > li.rt-node[role=treeitem] ...
 *     li.rt-node (item) > div.rt-row > button.rt-twisty + button.rt-label
 *       ul.rt-group[role=group] > li.rt-node ...           (children open in place)
 * Left items come first in the DOM, so arrow-key order reads left column, then right.
 */

/** Viewbox width of a curve between two stages; wide enough for 2 × the path's sway. */
const CURVE_W = 240;
const CURVE_H = 100;
/** Sideways swing of the stage boxes, px; the item columns keep a 64px gap (roadmap-tree.css). */
const SWAY = 32;

/** Status as a shape: empty ring, half-filled ring, filled ring with a check. */
function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="rt-badge rt-badge-status" data-status={status} aria-hidden="true">
      {status === "done" && <Check strokeWidth={3.5} />}
    </span>
  );
}

/** Priority as a letter (필/추/선) in a circle; fill and border style repeat it. */
function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className="rt-badge rt-badge-prio" data-priority={priority} aria-hidden="true">
      {PRIORITY_LABEL[priority].slice(0, 1)}
    </span>
  );
}

function Twisty({ node, onToggle }: { node: RoadmapNode; onToggle: (id: string) => void }) {
  return (
    <button
      type="button"
      className="rt-twisty"
      tabIndex={-1}
      aria-hidden="true"
      data-testid={`rt-toggle-${node.id}`}
      onClick={() => onToggle(node.id)}
    >
      <ChevronRight className="rt-chevron" strokeWidth={2.5} />
    </button>
  );
}

interface BranchProps {
  collapsed: CollapsedSet;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface ItemNodeProps extends BranchProps {
  node: RoadmapNode;
  level: number;
  /** Explicit set position: the stage's items span two groups (left/right). */
  pos?: { inSet: number; size: number };
}

function ItemNode({ node, level, pos, ...ctx }: ItemNodeProps) {
  const hasChildren = node.children.length > 0;
  const folded = ctx.collapsed.has(node.id);
  const meta = [node.priority ? PRIORITY_LABEL[node.priority] : null, STATUS_LABEL[node.status]]
    .filter(Boolean)
    .join(", ");
  return (
    <li
      className="rt-node rt-item"
      role="treeitem"
      tabIndex={-1}
      aria-level={level}
      aria-posinset={pos?.inSet}
      aria-setsize={pos?.size}
      aria-expanded={hasChildren ? !folded : undefined}
      aria-selected={ctx.selectedId === node.id}
      data-id={node.id}
      data-kind="item"
      data-depth={level}
      data-priority={node.priority ?? undefined}
      data-status={node.status}
    >
      <div className="rt-row">
        {hasChildren && <Twisty node={node} onToggle={ctx.onToggle} />}
        <button
          type="button"
          className="rt-label"
          tabIndex={-1}
          data-testid={`rm-item-${node.id}`}
          title={meta}
          onClick={() => ctx.onSelect(node.id)}
        >
          <span className="rt-title">{node.title}</span>
          <span className="sr-only">({meta})</span>
          {hasChildren && (
            <span className="rt-count" aria-hidden="true">
              {node.progress.done}/{node.progress.total}
            </span>
          )}
        </button>
        <span className="rt-badges">
          {node.priority && <PriorityBadge priority={node.priority} />}
          <StatusBadge status={node.status} />
        </span>
      </div>
      {hasChildren && !folded && (
        <ul className="rt-group rt-sub" role="group">
          {node.children.map((c) => (
            <ItemNode key={c.id} node={c} level={level + 1} {...ctx} />
          ))}
        </ul>
      )}
    </li>
  );
}

function SideGroup({
  side,
  items,
  offset,
  size,
  ...ctx
}: BranchProps & { side: Side; items: RoadmapNode[]; offset: number; size: number }) {
  if (items.length === 0) return null;
  return (
    <ul
      className="rt-group rt-side"
      role="group"
      data-side={side}
      data-many={items.length > 4 ? "" : undefined}
    >
      {items.map((c, i) => (
        <ItemNode key={c.id} node={c} level={2} pos={{ inSet: offset + i + 1, size }} {...ctx} />
      ))}
    </ul>
  );
}

/** Thick path from this stage's box down to the next one (ends meet both box centres). */
function Curve({ index }: { index: number }) {
  return (
    <svg
      className="rt-curve"
      viewBox={`0 0 ${CURVE_W} ${CURVE_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={stageCurvePath(index, { width: CURVE_W, height: CURVE_H, amplitude: SWAY })}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function StageNode({ row, ...ctx }: BranchProps & { row: StageRow }) {
  const { stage, index, folded, left, right, sway, hasNext } = row;
  const hasChildren = stage.children.length > 0;
  const status = stageStatus(stage);
  const { done, total } = stage.progress;
  const size = stage.children.length;
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
      data-first={index === 0 ? "" : undefined}
      data-sides={right.length > 0 ? "both" : left.length > 0 ? "left" : "none"}
      data-testid={`rm-stage-${stage.id}`}
      style={
        {
          "--rt-progress": ratio(stage.progress),
          "--rt-sway": `${sway}px`,
        } as CSSProperties
      }
    >
      {hasNext && <Curve index={index} />}
      <div className="rt-row rt-stage-row">
        <span className="rt-stage-num" aria-hidden="true">
          {index + 1}
        </span>
        <button
          type="button"
          className="rt-stage-label"
          tabIndex={-1}
          onClick={() => hasChildren && ctx.onToggle(stage.id)}
        >
          <span className="rt-stage-title">{stage.title}</span>
          <span className="rt-stage-meta" aria-hidden="true">
            <span className="rt-stage-bar" />
            <span className="rt-stage-count">
              {done}/{total}
            </span>
            {hasChildren && <ChevronRight className="rt-chevron" strokeWidth={2.5} />}
          </span>
        </button>
        <span className="rt-badges">
          <StatusBadge status={status} />
        </span>
      </div>
      <SideGroup side="left" items={left} offset={0} size={size} {...ctx} />
      <SideGroup side="right" items={right} offset={left.length} size={size} {...ctx} />
    </li>
  );
}

/** Stages down a curved centre path; items branch off to both sides with dotted links. */
export default function RoadmapTree({
  roadmap,
  selectedId,
  onSelect,
  collapsed,
  onToggle,
}: RoadmapTreeProps) {
  const treeRef = useRef<HTMLUListElement>(null);
  const { onKeyDown } = useTreeKeyboard({ rootRef: treeRef, collapsed, onToggle, onSelect });
  const ctx: BranchProps = { collapsed, onToggle, selectedId, onSelect };
  const rows = stageRows(roadmap.stages, collapsed, SWAY);

  return (
    <div className="rt-wrap">
      <ul
        ref={treeRef}
        onKeyDown={onKeyDown}
        className="rt-tree"
        role="tree"
        aria-label={`${roadmap.title} 로드맵`}
        data-testid="rm-tree"
      >
        {rows.map((row) => (
          <StageNode key={row.stage.id} row={row} {...ctx} />
        ))}
      </ul>
    </div>
  );
}
