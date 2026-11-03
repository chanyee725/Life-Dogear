import { Page } from "@/components/shell/PageHeader";

/**
 * Shown instantly while a route renders on the server. Every page is dynamic, so without this boundary
 * a sidebar click shows nothing until the whole page arrives; with it, Next.js prefetches the layout up
 * to here and swaps to this skeleton at once.
 */
export default function Loading() {
  return (
    <Page>
      <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
        <span className="sr-only">불러오는 중…</span>
        <div className="mb-8 flex flex-col gap-2">
          <div className="h-7 w-40 rounded-lg bg-hover" />
          <div className="h-4 w-64 rounded-lg bg-hover" />
        </div>
        <div className="mb-6 flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-hover" />
          <div className="h-8 w-20 rounded-lg bg-hover" />
          <div className="h-8 w-20 rounded-lg bg-hover" />
        </div>
        <div className="flex flex-col divide-y divide-border border-y border-border">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 py-3.5">
              <div className="h-4 flex-1 rounded bg-hover" />
              <div className="h-4 w-20 rounded bg-hover" />
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
