import type { ItemType } from "@/lib/enums";
import { itemPath } from "@/lib/item-path";

type Kind = Parameters<typeof itemPath>[0];

const KIND: Record<ItemType, Kind> = {
  project: "projects",
  area: "areas",
  paper: "papers",
  seminar: "seminars",
  thought: "thoughts",
  note: "notes",
  goal: "goals",
  review: "reviews",
};

/** Detail page href of an item by `ItemType`, e.g. `/papers/<slug>-<shortid>`. */
export const itemHref = (type: ItemType, id: string, title?: string | null): string =>
  itemPath(KIND[type], id, title);

/**
 * Route pattern of an item's detail page, for `revalidatePath(pattern, "page")`.
 * Detail URLs carry a slug, so revalidating `/<kind>/<id>` would miss them.
 */
export const itemRoutePattern = (type: ItemType): string => `/${KIND[type]}/[id]`;
