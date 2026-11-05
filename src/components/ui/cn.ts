import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export type { ClassValue };

/**
 * shadcn/ui `cn`: clsx joins class names (strings, arrays, `{ cls: bool }` maps,
 * falsy parts skipped), then tailwind-merge resolves conflicts so a later class
 * wins (`cn("px-2", "px-4")` → `"px-4"`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
