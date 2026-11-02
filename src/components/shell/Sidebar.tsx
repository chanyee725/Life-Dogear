import type { ReactNode } from "react";
import { areas, thoughts } from "@/lib/repo";
import { SidebarNav } from "./SidebarNav";

/**
 * App sidebar (server): reads the areas and the inbox count, then renders the client nav.
 * Area/archive/inbox actions revalidate the root layout, so this stays current.
 *
 * `searchSlot`: reserved for the 2팀 "검색 ⌘K" button (rendered under the app name).
 */
export async function Sidebar({ searchSlot }: { searchSlot?: ReactNode } = {}) {
  const [areaList, inboxCount] = await Promise.all([areas.list(), thoughts.countInbox()]);
  return (
    <SidebarNav
      areas={areaList.map((a) => ({ id: a.id, title: a.title }))}
      inboxCount={inboxCount}
      searchSlot={searchSlot}
    />
  );
}

export { NAV_SECTIONS, isActivePath } from "./nav";
