"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setRoadmapNodeStatus } from "@/app/_actions/learning-roadmap";
import ItemPanel from "./ItemPanel";
import { findNode, type LearningRoadmap, type Status } from "./model";
import RoadmapTree from "./RoadmapTree";

/** Tree plus the side panel of the selected item; a status change refreshes server data. */
export default function RoadmapView({ roadmap }: { roadmap: LearningRoadmap }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = selectedId ? (findNode(roadmap, selectedId) ?? null) : null;

  const onStatusChange = (nodeId: string, status: Status) => {
    setError(null);
    startTransition(async () => {
      const result = await setRoadmapNodeStatus(nodeId, status);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  return (
    <div className="flex items-start gap-6 max-lg:flex-col">
      <div className="min-w-0 flex-1 max-lg:w-full">
        <RoadmapTree
          roadmap={roadmap}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
        />
      </div>
      {selected && (
        <div className="w-80 shrink-0 lg:sticky lg:top-6 max-lg:w-full">
          {error && (
            <p role="alert" className="mb-2 text-sm text-[var(--rb-danger,red)]">
              {error}
            </p>
          )}
          <ItemPanel
            item={selected}
            onClose={() => setSelectedId(null)}
            onStatusChange={onStatusChange}
            pending={pending}
          />
        </div>
      )}
    </div>
  );
}
