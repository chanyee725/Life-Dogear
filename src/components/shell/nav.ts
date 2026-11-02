/** Static sidebar entries (areas are listed dynamically between 프로젝트 and 자료). */
export const NAV_SECTIONS = {
  top: [
    { href: "/", label: "홈", icon: "home" },
    { href: "/inbox", label: "수집함", icon: "inbox" },
  ],
  projects: [{ href: "/projects", label: "프로젝트", icon: "project" }],
  library: [
    { href: "/papers", label: "논문", icon: "paper" },
    { href: "/seminars", label: "세미나", icon: "seminar" },
    { href: "/thoughts", label: "생각", icon: "thought" },
    { href: "/tags", label: "주제", icon: "tag" },
  ],
  bottom: [{ href: "/archive", label: "보관함", icon: "archive" }],
} as const;

export type NavIcon = (typeof NAV_SECTIONS)[keyof typeof NAV_SECTIONS][number]["icon"];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
