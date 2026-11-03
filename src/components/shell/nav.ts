/**
 * Static sidebar entries (areas are listed dynamically between 목표와 프로젝트 and 자료).
 * IA: docs/PROPOSAL-SECOND-BRAIN.md 4절 — reviews sit near home, goals with projects,
 * the graph under 자료.
 */
export const NAV_SECTIONS = {
  top: [
    { href: "/", label: "홈", icon: "home" },
    { href: "/inbox", label: "수집함", icon: "inbox" },
    { href: "/reviews", label: "회고", icon: "review" },
  ],
  projects: [
    { href: "/goals", label: "목표", icon: "goal" },
    { href: "/projects", label: "프로젝트", icon: "project" },
  ],
  library: [
    { href: "/papers", label: "논문", icon: "paper" },
    { href: "/seminars", label: "세미나", icon: "seminar" },
    { href: "/thoughts", label: "생각", icon: "thought" },
    { href: "/tags", label: "주제", icon: "tag" },
    { href: "/graph", label: "그래프", icon: "graph" },
  ],
  bottom: [{ href: "/archive", label: "보관함", icon: "archive" }],
} as const;

export type NavIcon = (typeof NAV_SECTIONS)[keyof typeof NAV_SECTIONS][number]["icon"];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
