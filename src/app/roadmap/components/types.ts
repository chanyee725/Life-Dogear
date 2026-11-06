/** Shared prop contracts for the learning-roadmap side components. */

export type ResourceKind = "book" | "course" | "paper" | "video" | "code" | "doc";
export type NodeStatus = "todo" | "doing" | "done";

export interface NodeResource {
  kind: ResourceKind;
  title: string;
  url: string;
}

export interface NodeDetail {
  id: string;
  title: string;
  description: string | null;
  status: NodeStatus;
  resources: NodeResource[];
}

export interface NodeDetailPanelProps {
  /** Selected node, or null when nothing is selected (renders nothing). */
  node: NodeDetail | null;
  onStatusChange: (nodeId: string, status: NodeStatus) => void;
  onClose: () => void;
  /** Disable status buttons while a server action is in flight. */
  pending?: boolean;
  className?: string;
}

export interface RoadmapOption {
  id: string;
  title: string;
}

export interface RoadmapPickerProps {
  roadmaps: RoadmapOption[];
  selectedId: string | null;
  onSelect: (roadmapId: string) => void;
  className?: string;
}

export interface RoadmapEmptyStateProps {
  className?: string;
}
