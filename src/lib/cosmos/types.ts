/**
 * `GET /api/graph/cosmos` contract (same query as `/api/graph`). Plain types only: safe
 * to import from client components.
 */
import type { GraphNode, GraphNodeId, GraphResponse } from "@/lib/graph/types";

/** A node's importance and its parts (what the home screen needs). */
export type CosmosScore = {
  /** Importance 0..1 (docs/design/cosmos.md 8절; src/lib/cosmos/score.ts). */
  score: number;
  direct: number;
  centrality: number;
  recency: number;
  starred: boolean;
  lastActiveAt: string | null;
};

/** `getCosmosScores`: nodes and scores only (no galaxies or panel lists). */
export type CosmosScores = {
  nodes: GraphNode[];
  cosmos: Record<GraphNodeId, CosmosScore>;
};

export type CosmosNodeInfo = CosmosScore & {
  /** An active life goal: drawn as a sun at the centre (achieved/dropped ones are not). */
  sun: boolean;
  /** Area id of the node's galaxy; null = neutral (no area) or a life goal (the sun). */
  galaxy: string | null;
};

export type CosmosResponse = GraphResponse & {
  cosmos: Record<GraphNodeId, CosmosNodeInfo>;
  /** Galaxies in area order, for the legend and colors. */
  galaxies: { id: string; title: string }[];
  /** Side panel: importance Top 10. */
  top: GraphNodeId[];
  /** Side panel: unconnected nodes (외톨이 별), all of them — the panel shows 8 + "n개 더". */
  lonely: GraphNodeId[];
  /** Side panel: score ≥ 0.55 and untouched for 45+ days (max 5). */
  neglected: GraphNodeId[];
};
