import { twMerge } from "tailwind-merge";

/**
 * Joins class names, skipping falsy parts (clsx style), and resolves Tailwind
 * conflicts so a later class wins (`cn("px-2", "px-4")` → `"px-4"`).
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(...parts);
}
