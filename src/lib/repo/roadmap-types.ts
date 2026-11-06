export type RoadmapKind = 'area' | 'goal' | 'project' | 'task';
export interface RoadmapNode {
  kind: RoadmapKind;
  id: string;           // unique within kind; virtual no-area node uses 'none'
  title: string;
  href: string | null;  // detail page; task -> parent project href
  status: string | null;
  progress: number | null; // 0..1 for goal/project, else null
  due: string | null;   // due date / period label
  done?: boolean;       // task only
  children: RoadmapNode[];
}
export interface RoadmapData { roots: RoadmapNode[]; includeDone: boolean }
