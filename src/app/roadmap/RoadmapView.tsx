"use client";

import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";
import { setRoadmapNodeStatus } from "@/app/_actions/learning-roadmap";
import { useTreeCollapse } from "./collapse";
import ItemPanel, { PriorityMark, StatusIcon } from "./ItemPanel";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  findNode,
  ratio,
  stageStatus,
  type LearningRoadmap,
  type Status,
} from "./model";
import RoadmapTree from "./RoadmapTree";

/** Boxed key in the top-left corner: priority as mini nodes, status as the tree's icons. */
function Legend() {
  return (
    <div className="rv-legend" aria-label="범례" role="group">
      <ul className="rv-legend-group" aria-label="우선순위">
        {PRIORITIES.map((p) => (
          <li key={p} className="rv-legend-item" data-priority={p}>
            <span className="rv-legend-badge">
              <PriorityMark priority={p} />
              {PRIORITY_LABEL[p]}
            </span>
          </li>
        ))}
      </ul>
      <ul className="rv-legend-group" aria-label="진행 상태">
        {STATUSES.map((s) => (
          <li key={s} className="rv-legend-item" data-status={s}>
            <StatusIcon status={s} size={15} />
            {STATUS_LABEL[s]}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One segment per stage, width by item count, fill by that stage's done share. */
function StageTrail({ roadmap }: { roadmap: LearningRoadmap }) {
  return (
    <div
      className="rv-trail"
      role="progressbar"
      aria-label="전체 진행률"
      aria-valuemin={0}
      aria-valuemax={roadmap.progress.total}
      aria-valuenow={roadmap.progress.done}
      aria-valuetext={`${roadmap.progress.total}개 중 ${roadmap.progress.done}개 완료`}
    >
      {roadmap.stages.map((s, i) => (
        <span
          key={s.id}
          className="rv-trail-seg"
          data-status={stageStatus(s)}
          title={`${i + 1}단계 ${s.title}: ${s.progress.done}/${s.progress.total}`}
          style={
            {
              flexGrow: Math.max(s.progress.total, 1),
              "--rv-fill": ratio(s.progress),
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Header (title, overall progress, legend, fold-all), the tree, and the selected item's panel. */
export default function RoadmapView({ roadmap }: { roadmap: LearningRoadmap }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tree = useTreeCollapse(roadmap.stages);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = selectedId ? (findNode(roadmap, selectedId) ?? null) : null;

  const allFolded = !tree.allExpanded;
  const { done, total } = roadmap.progress;
  const percent = Math.round(ratio(roadmap.progress) * 100);
  const stagesDone = roadmap.stages.filter((s) => stageStatus(s) === "done").length;

  const onStatusChange = (nodeId: string, status: Status) => {
    setError(null);
    startTransition(async () => {
      const result = await setRoadmapNodeStatus(nodeId, status);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  return (
    <div className="rv-root">
      <header className="rv-head">
        <Legend />

        <div className="rv-head-main">
          <h2 className="rv-title">{roadmap.title}</h2>
          {roadmap.summary && <p className="rv-summary">{roadmap.summary}</p>}
        </div>

        <div className="rv-progress">
          <p className="rv-progress-figure">
            <span className="rv-progress-percent">{percent}%</span>
            <span className="rv-progress-detail">
              항목 {done}/{total} 완료, 단계 {stagesDone}/{roadmap.stages.length} 끝냄
            </span>
          </p>
          <StageTrail roadmap={roadmap} />
          <button
            type="button"
            className="rv-fold-all"
            data-testid="rv-fold-all"
            onClick={() => (allFolded ? tree.expandAll() : tree.collapseAll())}
          >
            {allFolded ? (
              <ChevronsUpDown size={15} aria-hidden />
            ) : (
              <ChevronsDownUp size={15} aria-hidden />
            )}
            {allFolded ? "모두 펼치기" : "모두 접기"}
          </button>
        </div>
      </header>

      <div className="rv-body" data-panel={selected ? "open" : "closed"}>
        <div className="rv-tree-col">
          <RoadmapTree
            roadmap={roadmap}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
            collapsed={tree.collapsed}
            onToggle={(id: string) => tree.toggle(id)}
          />
        </div>
        {selected && (
          <div className="rv-panel-col">
            {error && (
              <p role="alert" className="rv-error">
                {error}
              </p>
            )}
            <ItemPanel
              item={selected}
              onClose={() => setSelectedId(null)}
              onStatusChange={onStatusChange}
              pending={pending}
              onSelect={setSelectedId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
