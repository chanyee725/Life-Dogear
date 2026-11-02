"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { Kbd } from "@/components/ui/Kbd";
import {
  HomeIcon,
  PaperIcon,
  ProjectIcon,
  SeminarIcon,
  SidebarIcon,
  TagIcon,
  ThoughtIcon,
} from "./icons";
import { setSidebarCollapsed } from "./sidebar-state";
import { ThemeToggle } from "./ThemeToggle";

export const NAV_ITEMS = [
  { href: "/", label: "홈", icon: HomeIcon },
  { href: "/projects", label: "연구", icon: ProjectIcon },
  { href: "/papers", label: "논문", icon: PaperIcon },
  { href: "/seminars", label: "세미나", icon: SeminarIcon },
  { href: "/thoughts", label: "생각", icon: ThoughtIcon },
  { href: "/tags", label: "태그", icon: TagIcon },
] as const;

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname() ?? "/";

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
        <nav aria-label="주 메뉴" className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                  active
                    ? "bg-hover font-medium text-fg"
                    : "text-muted hover:bg-hover hover:text-fg",
                )}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <div className="flex flex-col gap-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Kbd>N</Kbd> 새 항목
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>/</Kbd> 빠른 입력
            </span>
          </div>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
