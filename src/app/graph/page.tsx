import type { Metadata } from "next";
import { areas, tags } from "@/lib/repo";
import { GraphScreen } from "./GraphScreen";

export const metadata: Metadata = { title: "그래프" };
export const dynamic = "force-dynamic";

/** `/graph` — the whole graph. Filter options (areas, topics) come from the server. */
export default async function GraphPage() {
  const [areaRows, tagRows] = await Promise.all([
    areas.list(),
    tags.listAll({ visibleOnly: true }),
  ]);
  return (
    <GraphScreen
      options={{
        areas: areaRows.map((a) => ({ id: a.id, title: a.title })),
        tags: tagRows.map((t) => t.name),
      }}
    />
  );
}
