import { NextResponse, type NextRequest } from "next/server";
import { getLocalGraph } from "@/lib/graph/load";
import { parseLocalQuery } from "@/lib/graph/query";
import { jsonError, NO_STORE, serverError } from "../_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /api/graph/local?node=<type>:<id>&depth=1|2` → `GraphData`; 404 for an unknown node. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const query = parseLocalQuery(request.nextUrl.searchParams);
  if (!query) return jsonError(400, "잘못된 노드입니다.");
  try {
    const graph = await getLocalGraph(query.node, query.depth);
    if (!graph.nodes.length) return jsonError(404, "항목을 찾을 수 없습니다.");
    return NextResponse.json(graph, { headers: NO_STORE });
  } catch (error) {
    return serverError("/local", error);
  }
}
