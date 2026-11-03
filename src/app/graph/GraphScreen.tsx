"use client";

import dynamic from "next/dynamic";
import type { FilterOptions } from "@/components/graph/GraphFilterBar";

// Canvas, window and localStorage: render on the client only.
const GraphView = dynamic(() => import("@/components/graph/GraphView"), {
  ssr: false,
  loading: () => <div className="h-dvh bg-bg" />,
});

export function GraphScreen({ options }: { options: FilterOptions }) {
  return <GraphView options={options} />;
}
