"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Kbd } from "@/components/ui/Kbd";
import {
  ArchiveIcon,
  AreaIcon,
  GoalIcon,
  GraphIcon,
  HomeIcon,
  InboxIcon,
  PaperIcon,
  PlusIcon,
  ProjectIcon,
  ReviewIcon,
  SeminarIcon,
  SidebarIcon,
  TagIcon,
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
  seminar: SeminarIcon,
  thought: ThoughtIcon,
  tag: TagIcon,
  archive: ArchiveIcon,
  review: ReviewIcon,
  goal: GoalIcon,
  graph: GraphIcon,
};

const linkClass = (active: boolean) =>
  cn(
    "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
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
    <div className="mt-4 mb-1 flex h-6 items-center justify-between pr-1 pl-2.5">
      <span className="text-xs font-medium text-muted">{children}</span>
      {action}
    </div>
  );
}

export function SidebarNav({
  areas,
  inboxCount,
  searchSlot,
}: {
  areas: { id: string; title: string }[];
  inboxCount: number;
  searchSlot?: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
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
      {/* Shown only while collapsed (focus mode): brings the sidebar back on any page. */}
      <button
        type="button"
        onClick={() => setSidebarCollapsed(false)}
        aria-label="사이드바 열기"
        title="사이드바 열기"
        className="fixed top-3 left-3 z-30 hidden h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg text-muted hover:bg-hover hover:text-fg in-data-[sidebar=collapsed]:flex"
      >
        <SidebarIcon />
      </button>
      <aside className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col border-r border-border bg-surface in-data-[sidebar=collapsed]:hidden">
        <div className="flex h-14 items-center justify-between pr-2 pl-5">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
            Research Brain
          </Link>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
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
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3"
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

          <SectionTitle
            action={
              <Link
                href="/areas/new"
                aria-label="새 영역"
                title="새 영역"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
              >
                <PlusIcon />
              </Link>
            }
          >
            <Link href="/areas" className="hover:text-fg">
              영역
            </Link>
          </SectionTitle>
          {areas.length === 0 ? (
            <RecommendedAreas />
          ) : (
            areas.map((area) => (
              <NavLink
                key={area.id}
                href={`/areas/${area.id}`}
                label={area.title}
                icon={<AreaIcon />}
                pathname={pathname}
              />
            ))
          )}

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

          <div className="mt-4" />
          {NAV_SECTIONS.bottom.map((entry) => item(entry))}
        </nav>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <div className="flex flex-col gap-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Kbd>N</Kbd> 새 항목
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>/</Kbd> 빠른 입력
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>G</Kbd> 그래프
            </span>
          </div>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
