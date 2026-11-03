import type { SVGProps } from "react";

/** Minimal 16px stroke icons used by the shell. */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = () => (
  <Icon>
    <path d="M2.5 7 8 2.5 13.5 7v6a.5.5 0 0 1-.5.5H10V10H6v3.5H3a.5.5 0 0 1-.5-.5Z" />
  </Icon>
);
export const ProjectIcon = () => (
  <Icon>
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
  </Icon>
);
export const PaperIcon = () => (
  <Icon>
    <path d="M4 1.5h5.5L12.5 4.5V14a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5Z" />
    <path d="M9.5 1.5v3h3M5.5 8h5M5.5 10.5h5" />
  </Icon>
);
export const SeminarIcon = () => (
  <Icon>
    <rect x="1.5" y="2.5" width="13" height="8.5" rx="1.5" />
    <path d="M8 11v2.5M5.5 13.5h5" />
  </Icon>
);
export const ThoughtIcon = () => (
  <Icon>
    <path d="M8 1.75a4.25 4.25 0 0 0-2.5 7.69V11h5V9.44A4.25 4.25 0 0 0 8 1.75Z" />
    <path d="M6 13.25h4" />
  </Icon>
);
export const TagIcon = () => (
  <Icon>
    <path d="M1.75 2.75v4.1a1 1 0 0 0 .3.7l6.2 6.2a1 1 0 0 0 1.4 0l3.9-3.9a1 1 0 0 0 0-1.4l-6.2-6.2a1 1 0 0 0-.7-.3h-4.1a.8.8 0 0 0-.8.8Z" />
    <circle cx="4.75" cy="5" r="0.9" />
  </Icon>
);
export const SunIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="2.75" />
    <path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
  </Icon>
);
export const MoonIcon = () => (
  <Icon>
    <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z" />
  </Icon>
);
export const MonitorIcon = () => (
  <Icon>
    <rect x="1.75" y="2.5" width="12.5" height="8.5" rx="1.5" />
    <path d="M6 14h4M8 11v3" />
  </Icon>
);
export const SidebarIcon = () => (
  <Icon>
    <rect x="1.75" y="2.5" width="12.5" height="11" rx="1.5" />
    <path d="M5.5 2.5v11" />
  </Icon>
);
export const InboxIcon = () => (
  <Icon>
    <path d="M2 9.5h3.25l1 1.75h3.5l1-1.75H14" />
    <path d="M3.6 3.5h8.8L14 9.5V13a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 2 13V9.5Z" />
  </Icon>
);
/** Stacked layers: ongoing areas of responsibility (distinct from the goal target). */
export const AreaIcon = () => (
  <Icon>
    <path d="M8 2.25 14 5.5 8 8.75 2 5.5Z" />
    <path d="m2 8.25 6 3.25 6-3.25" />
    <path d="m2 11 6 3.25L14 11" />
  </Icon>
);
export const ArchiveIcon = () => (
  <Icon>
    <rect x="1.75" y="2.5" width="12.5" height="3" rx="0.75" />
    <path d="M2.75 5.5V13a.5.5 0 0 0 .5.5h9.5a.5.5 0 0 0 .5-.5V5.5M6.5 8.5h3" />
  </Icon>
);
export const PlusIcon = () => (
  <Icon>
    <path d="M8 3v10M3 8h10" />
  </Icon>
);
export const GoalIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="5.75" />
    <circle cx="8" cy="8" r="2.75" />
    <circle cx="8" cy="8" r="0.5" fill="currentColor" />
  </Icon>
);
export const ReviewIcon = () => (
  <Icon>
    <path d="M2.75 8a5.25 5.25 0 1 0 1.6-3.77" />
    <path d="M2.5 2.75v2.5H5" />
    <path d="M8 5.25V8l1.75 1.25" />
  </Icon>
);
export const TaskIcon = () => (
  <Icon>
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    <path d="m5.25 8.25 1.9 1.85 3.6-4" />
  </Icon>
);
export const GraphIcon = () => (
  <Icon>
    <circle cx="4" cy="4.5" r="1.75" />
    <circle cx="12" cy="4" r="1.5" />
    <circle cx="8.5" cy="12" r="1.75" />
    <path d="M5.6 5.2 7.6 10.4M5.7 4.4 10.5 4.1M11.4 5.4 9.2 10.4" />
  </Icon>
);
