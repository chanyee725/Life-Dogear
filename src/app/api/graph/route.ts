import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/app/api/papers/_lib/origin";
import { getGraph } from "@/lib/graph/load";
import { parseGraphFilter } from "@/lib/graph/query";
import { forbidden, NO_STORE, serverError } from "./_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /api/graph?types=&area=&tag=&archived=0|1&orphans=0|1` → `GraphResponse`. Read-only, same-origin only. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Same-origin only, like /api/search: the graph lists private titles.
  if (!isSameOriginRequest(request.headers)) return forbidden();
  try {
    const graph = await getGraph(parseGraphFilter(request.nextUrl.searchParams));
    return NextResponse.json(graph, { headers: NO_STORE });
  } catch (error) {
    return serverError("", error);
  }
}
