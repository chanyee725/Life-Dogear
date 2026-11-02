import { NextResponse, type NextRequest } from "next/server";
import { describeError } from "@/app/_actions/result";
import type { NodePreview } from "@/components/graph/preview-types";
import { parseGraphNodeId } from "@/lib/graph/types";
import { isValidItemId } from "@/lib/ids";
import { areas, papers, projects, seminars, thoughts } from "@/lib/repo";
import { areaPreview, paperPreview, projectPreview, seminarPreview, thoughtPreview } from "./build";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const json = (status: number, body: unknown) =>
  NextResponse.json(body, { status, headers: NO_STORE });

/**
 * `GET /graph/preview?node=<type>:<id>` → `NodePreview` (graph side panel). Read-only.
 * Archived items are allowed (shown as 보관). Goals, reviews and topics get an empty
 * preview until their repos land; the panel then shows only the graph's own data.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ref = parseGraphNodeId(request.nextUrl.searchParams.get("node"));
  if (!ref || !isValidItemId(ref.id)) return json(400, { error: "잘못된 노드입니다." });

  try {
    let preview: NodePreview | null;
    switch (ref.type) {
      case "project": {
        const row = await projects.get(ref.id);
        preview = row && projectPreview(row);
        break;
      }
      case "paper": {
        const row = await papers.get(ref.id);
        preview = row && paperPreview(row);
        break;
      }
      case "seminar": {
        const row = await seminars.get(ref.id);
        preview = row && seminarPreview(row);
        break;
      }
      case "thought": {
        const row = await thoughts.get(ref.id);
        preview = row && thoughtPreview(row);
        break;
      }
      case "area": {
        const row = await areas.get(ref.id);
        const count = row
          ? (await projects.list({ areaId: ref.id, includeArchived: !!row.archivedAt })).length
          : 0;
        preview = row && areaPreview(row, count);
        break;
      }
      default:
        preview = { props: [] };
    }
    if (!preview) return json(404, { error: "항목을 찾을 수 없습니다." });
    return json(200, preview);
  } catch (error) {
    console.error("[graph/preview]", describeError(error));
    return json(500, { error: "요청을 처리하지 못했습니다." });
  }
}
