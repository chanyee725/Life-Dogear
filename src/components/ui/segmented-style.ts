import { cn } from "./cn";

/** Shared look of segmented controls: a subtle track with a raised checked option. */
export const segTrack = "flex gap-0.5 rounded-lg bg-subtle p-0.5";
export const segItem = (active: boolean) =>
  cn(
    "flex h-6 items-center justify-center rounded-md px-2.5 text-[13px] transition-colors",
    active ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg",
  );
