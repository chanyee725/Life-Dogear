"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "./cn";
import {
  Tooltip as TooltipRoot,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./primitives/tooltip";

/** Hover delay before a hint shows (keyboard focus shows it at once). */
export const TOOLTIP_DELAY = 400;

/**
 * Hover/focus hint for a control (Radix Tooltip), in place of a `title` attribute.
 * `children` must be one focusable element that takes a ref (it becomes the trigger
 * via `asChild`); keep its own `aria-label`, since the hint only adds a description.
 *
 * Each hint carries its own TooltipProvider (the shadcn default): it needs no app-level
 * wrapper, so server-rendered pages, unit renders and portals all work without setup.
 */
export function Tooltip({
  content,
  side = "top",
  align = "center",
  className,
  children,
}: {
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  children: ReactElement;
}) {
  return (
    <TooltipProvider delayDuration={TOOLTIP_DELAY}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          sideOffset={4}
          collisionPadding={8}
          className={cn(
            "pointer-events-none max-w-64 px-2 py-1",
            "transition-[opacity,scale] duration-100 ease-out starting:scale-95 starting:opacity-0 motion-reduce:transition-none",
            className,
          )}
        >
          {content}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}
