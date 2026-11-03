import { connection } from "next/server";
import type { ReactNode } from "react";
import { describeError } from "@/app/_actions/result";
import { areas, thoughts } from "@/lib/repo";
import { SidebarNav } from "./SidebarNav";

type SidebarData = {
  /** False with no (non-archived) areas at all: the sidebar offers recommended ones. */
  hasAreas: boolean;
  inboxCount: number;
};

const EMPTY: SidebarData = { hasAreas: true, inboxCount: 0 };

/** Whether any area exists, and the inbox count; on any database error the sidebar still renders, just without them. */
async function loadSidebarData(): Promise<SidebarData> {
  try {
    const [areaList, inboxCount] = await Promise.all([areas.list(), thoughts.countInbox()]);
    return {
      hasAreas: areaList.length > 0,
      inboxCount,
    };
  } catch (error) {
    // Name and code only: the error object carries SQL, params, stacks and local paths.
    console.error("[sidebar] could not load areas or the inbox count", describeError(error));
    return EMPTY;
  }
}

/**
 * App sidebar (server): checks for areas and reads the inbox count, then renders the client nav.
 * Area/archive/inbox actions revalidate the root layout, so this stays current.
 *
 * `connection()` defers the database reads to request time, so `next build` never
 * queries the database (prerendering, e.g. /_not-found, would otherwise need a migrated DB).
 *
 * `searchSlot`: reserved for the 2팀 "검색 ⌘K" button (rendered under the app name).
 */
export async function Sidebar({ searchSlot }: { searchSlot?: ReactNode } = {}) {
  // Outside the try: it signals dynamic rendering to Next and must not be swallowed.
  await connection();
  const data = await loadSidebarData();
  return (
    <SidebarNav
      hasAreas={data.hasAreas}
      inboxCount={data.inboxCount}
      searchSlot={searchSlot}
    />
  );
}

export { NAV_SECTIONS, isActivePath } from "./nav";
