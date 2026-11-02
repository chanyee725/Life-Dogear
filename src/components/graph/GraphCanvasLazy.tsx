"use client";

import dynamic from "next/dynamic";

/** The canvas touches `window` on import: load it on the client only. */
export const GraphCanvasLazy = dynamic(() => import("./GraphCanvas"), {
  ssr: false,
  loading: () => null,
});
