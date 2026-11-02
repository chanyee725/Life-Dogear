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
