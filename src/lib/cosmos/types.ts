/**
 * `GET /api/graph/cosmos` contract (same query as `/api/graph`). Plain types only: safe
 * to import from client components.
 */
import type { GraphNodeId, GraphResponse } from "@/lib/graph/types";

export type CosmosNodeInfo = {
  /** Importance 0..1 (docs/PLAN-COSMOS.md C2; weights in src/lib/cosmos/score.ts). */
  score: number;
  intrinsic: number;
  centrality: number;
  recency: number;
  starred: boolean;
  /** Area id of the node's galaxy; null = neutral (no area) or a life goal (the sun). */
  galaxy: string | null;
  lastActiveAt: string | null;
};

export type CosmosResponse = GraphResponse & {
  cosmos: Record<GraphNodeId, CosmosNodeInfo>;
  /** Galaxies in area order, for the legend and colors. */
  galaxies: { id: string; title: string }[];
  /** Side panel: importance Top 10. */
  top: GraphNodeId[];
  /** Side panel: unconnected nodes (외톨이 별). */
  lonely: GraphNodeId[];
  /** Side panel: important but untouched for 60+ days. */
  neglected: GraphNodeId[];
};
