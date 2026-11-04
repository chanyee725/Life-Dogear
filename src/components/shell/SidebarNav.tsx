"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Kbd } from "@/components/ui/Kbd";
import {
  ArchiveIcon,
  AreaIcon,
  GoalIcon,
  GraphIcon,
  HomeIcon,
  InboxIcon,
  NoteIcon,
  PaperIcon,
  ProjectIcon,
  ReviewIcon,
  SeminarIcon,
  SidebarIcon,
  TagIcon,
  TaskIcon,
  ThoughtIcon,
} from "./icons";
import { isActivePath, LIBRARY_HREF, NAV_SECTIONS, type NavIcon } from "./nav";
import { RecommendedAreas } from "./RecommendedAreas";
import { setSidebarCollapsed } from "./sidebar-state";
import { ThemeToggle } from "./ThemeToggle";

const ICONS: Record<NavIcon, () => ReactNode> = {
  home: HomeIcon,
  inbox: InboxIcon,
  project: ProjectIcon,
  paper: PaperIcon,
  note: NoteIcon,
  seminar: SeminarIcon,
  thought: ThoughtIcon,
  tag: TagIcon,
  archive: ArchiveIcon,
  review: ReviewIcon,
  goal: GoalIcon,
  area: AreaIcon,
  graph: GraphIcon,
  task: TaskIcon,
};

/** Below Tailwind's `md`: the sidebar becomes a drawer. */
const NARROW_QUERY = "(max-width: 767.98px)";

const linkClass = (active: boolean) =>
  cn(
    // 18px icons (the shell icons are drawn at 16): easier to scan and to hit.
    "flex h-9 shrink-0 items-center gap-3 rounded-lg px-3 text-sm transition-colors [&>svg]:size-[18px] [&>svg]:shrink-0",
    active ? "bg-hover font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
  );

function NavLink({
  href,
  label,
  icon,
  pathname,
  badge,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  pathname: string;
  badge?: ReactNode;
}) {
  const active = isActivePath(pathname, href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <PendingDot />
      {badge}
    </Link>
  );
}

/** Lights up on the clicked link until its page arrives, so a click always gets instant feedback. */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`size-1.5 shrink-0 rounded-full bg-accent transition-opacity duration-150 motion-reduce:transition-none ${pending ? "opacity-100" : "opacity-0"}`}
    />
  );
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-6 mb-1.5 flex h-6 shrink-0 items-center justify-between pr-1 pl-3">
      <span className="text-xs font-medium text-muted">{children}</span>
      {action}
    </div>
  );
}

export function SidebarNav({
  hasAreas,
  inboxCount,
  searchSlot,
  footerSlot,
}: {
  /** False when no areas exist at all: recommended areas are offered instead. */
  hasAreas: boolean;
  inboxCount: number;
  searchSlot?: ReactNode;
  /** Under the theme toggle (the sign-out button in login mode). */
  footerSlot?: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  // Narrow screens: the sidebar is a drawer over the page, open until the next navigation.
  const [drawerOn, setDrawerOn] = useState<string | null>(null);
  const drawerOpen = drawerOn === pathname;
  const narrow = () => window.matchMedia(NARROW_QUERY).matches;
  const asideRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Move focus into the drawer so keyboard users land in the menu they opened.
    if (drawerOpen) asideRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
  }, [drawerOpen]);
  const item = (entry: { href: string; label: string; icon: NavIcon }, badge?: ReactNode) => {
    const Icon = ICONS[entry.icon];
    return (
      <NavLink
        key={entry.href}
        href={entry.href}
        label={entry.label}
        icon={<Icon />}
        pathname={pathname}
        badge={badge}
      />
    );
  };

  return (
    <>
      {/* Shown while collapsed (focus mode) and on narrow screens: brings the sidebar back. */}
      <button
        type="button"
        onClick={() => (narrow() ? setDrawerOn(pathname) : setSidebarCollapsed(false))}
        aria-label="사이드바 열기"
        title="사이드바 열기"
        aria-expanded={drawerOpen || undefined}
        className="fixed top-3 left-3 z-30 hidden h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg text-muted hover:bg-hover hover:text-fg in-data-[sidebar=collapsed]:flex max-md:flex"
      >
        <SidebarIcon />
      </button>
      {drawerOpen ? (
        <div
          aria-hidden
          onClick={() => setDrawerOn(null)}
          className="fixed inset-0 z-40 bg-fg/20 md:hidden"
        />
      ) : null}
      <aside
        ref={asideRef}
        onKeyDown={(e) => {
          if (drawerOpen && e.key === "Escape") setDrawerOn(null);
        }}
        className={cn(
          "sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface in-data-[sidebar=collapsed]:hidden",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50",
          drawerOpen ? "max-md:in-data-[sidebar=collapsed]:flex" : "max-md:hidden",
        )}
      >
        <div className="flex h-14 items-center justify-between pr-2 pl-5">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
            Life Dogear
          </Link>
          <button
            type="button"
            onClick={() => (narrow() ? setDrawerOn(null) : setSidebarCollapsed(true))}
            aria-label="사이드바 접기"
            title="사이드바 접기"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
          >
            <SidebarIcon />
          </button>
        </div>
        {/* 2팀: "검색 ⌘K" button goes here. */}
        {searchSlot ? <div className="px-3 pb-2">{searchSlot}</div> : null}
        <nav
          aria-label="주 메뉴"
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-1 pb-3"
        >
          {item(NAV_SECTIONS.top[0])}
          {item(
            NAV_SECTIONS.top[1],
            inboxCount > 0 ? (
              <span className="text-xs text-muted tabular-nums" aria-label={`${inboxCount}개`}>
                {inboxCount}
              </span>
            ) : undefined,
          )}
          {NAV_SECTIONS.top.slice(2).map((entry) => item(entry))}

          <SectionTitle>목표와 프로젝트</SectionTitle>
          {NAV_SECTIONS.projects.map((entry) => item(entry))}

          {/* No areas yet: offer the recommended ones right under the 영역 entry. */}
          {hasAreas ? null : <RecommendedAreas />}

          <SectionTitle>
            <Link
              href={LIBRARY_HREF}
              aria-current={isActivePath(pathname, LIBRARY_HREF) ? "page" : undefined}
              className="hover:text-fg aria-[current=page]:text-fg"
            >
              자료
            </Link>
          </SectionTitle>
          {NAV_SECTIONS.library.map((entry) => item(entry))}

          <div className="mt-6 shrink-0" />
          {NAV_SECTIONS.bottom.map((entry) => item(entry))}
        </nav>
        <div className="flex flex-col gap-3 px-4 pb-4">
          {/* Short windows: the menu needs the room more than the shortcut hints. */}
          <div className="flex flex-col gap-1 text-xs text-muted [@media(max-height:799px)]:hidden">
            <span className="flex items-center gap-1.5">
              <Kbd>N</Kbd> 새 항목
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>/</Kbd> 빠른 입력
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>C</Kbd> 빠른 캡처
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>G</Kbd> 그래프
            </span>
          </div>
          <ThemeToggle />
          {footerSlot}
        </div>
      </aside>
    </>
  );
}
