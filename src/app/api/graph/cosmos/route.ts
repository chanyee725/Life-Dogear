import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/app/api/papers/_lib/origin";
import { getCosmos } from "@/lib/cosmos/load";
import { parseGraphFilter } from "@/lib/graph/query";
import { forbidden, NO_STORE, serverError } from "../_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /api/graph/cosmos?types=&area=&tag=&archived=0|1&orphans=0|1` → `CosmosResponse`
 * (the `/api/graph` graph plus importance, galaxies and side-panel lists). Read-only,
 * same-origin only.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request.headers)) return forbidden();
  try {
    const cosmos = await getCosmos(parseGraphFilter(request.nextUrl.searchParams));
    return NextResponse.json(cosmos, { headers: NO_STORE });
  } catch (error) {
    return serverError("/cosmos", error);
  }
}
