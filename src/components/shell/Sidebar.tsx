import { connection } from "next/server";
import type { ReactNode } from "react";
import { describeError } from "@/app/_actions/result";
import { currentAuthMode } from "@/lib/auth/server";
import { areas, thoughts } from "@/lib/repo";
import { SignOutButton } from "./SignOutButton";
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
 * `searchSlot`: reserved for the 2팀 "검색 ⌘/" button (rendered under the app name).
 * In login mode the footer gets a "로그아웃" button.
 */
export async function Sidebar({ searchSlot }: { searchSlot?: ReactNode } = {}) {
  // Outside the try: it signals dynamic rendering to Next and must not be swallowed.
  await connection();
  const [data, mode] = await Promise.all([loadSidebarData(), currentAuthMode()]);
  return (
    <SidebarNav
      hasAreas={data.hasAreas}
      inboxCount={data.inboxCount}
      searchSlot={searchSlot}
      // Only with Google sign-in on; the local, no-sign-in mode has nothing to sign out of.
      footerSlot={mode.kind === "login" ? <SignOutButton /> : undefined}
    />
  );
}

export { NAV_SECTIONS, isActivePath } from "./nav";
