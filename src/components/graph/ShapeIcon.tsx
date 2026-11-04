import type { GraphNodeType } from "@/lib/graph/types";
import type { GoalHorizon } from "@/lib/graph/types";
import type { GraphTheme } from "./graph-theme";

/** Node colors for icons in lists (search results, preview neighbours). */
export type IconPaint = {
  color: (node: { id: string; type: GraphNodeType }) => string;
  quarterFill: string;
};

/**
 * 10×10 icon in a node kind's canvas shape (filter chips double as the legend, 1.4).
 * `color` paints every part (and `quarterFill` the quarter goal's inside); without it the
 * legacy theme slots are used (the cosmos side panel builds those).
 */
export function ShapeIcon({
  type,
  horizon,
  theme,
  color,
  quarterFill,
  className,
}: {
  type: GraphNodeType;
  horizon?: GoalHorizon;
  theme: GraphTheme;
  color?: string;
  quarterFill?: string;
  className?: string;
}) {
  const c = (legacy: string) => color ?? legacy;
  const common = {
    className,
    width: 10,
    height: 10,
    viewBox: "0 0 10 10",
    "aria-hidden": true,
  } as const;
  switch (type) {
    case "goal":
      return horizon === "quarter" ? (
        <svg {...common}>
          <circle
            cx="5"
            cy="5"
            r="3.6"
            fill={color ? (quarterFill ?? theme.goalSoft) : theme.accentSoft}
            stroke={c(theme.accent)}
            strokeWidth="1.4"
          />
        </svg>
      ) : (
        <svg {...common}>
          <circle cx="5" cy="5" r="4" fill={c(theme.accent)} />
        </svg>
      );
    case "area":
      return (
        <svg {...common}>
          <rect x="1" y="1" width="8" height="8" rx="1.5" fill={c(theme.gray1)} />
        </svg>
      );
    case "project":
      return (
        <svg {...common}>
          <path d="M5 0.5 9.5 5 5 9.5 0.5 5Z" fill={c(theme.gray2)} />
        </svg>
      );
    case "paper":
      return (
        <svg {...common}>
          <circle cx="5" cy="5" r="4" fill={c(theme.gray3)} />
        </svg>
      );
    case "seminar":
      return (
        <svg {...common}>
          <path d="M5 0.8 9.4 8.6H0.6Z" fill={c(theme.gray3)} />
        </svg>
      );
    case "note":
      return (
        <svg {...common}>
          <path d="M5 9.2 9.4 1.4H0.6Z" fill={c(theme.gray3)} />
        </svg>
      );
    case "thought":
      return (
        <svg {...common}>
          <circle cx="5" cy="5" r="3.4" fill="none" stroke={c(theme.gray4)} strokeWidth="1.6" />
        </svg>
      );
    case "review":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="6" height="6" rx="1" fill={c(theme.gray5)} />
        </svg>
      );
    case "tag":
      return (
        <svg {...common}>
          <path d="M5 1 9 5 5 9 1 5Z" fill="none" stroke={c(theme.gray5)} strokeWidth="1.2" />
        </svg>
      );
    case "task":
      return (
        <svg {...common}>
          <rect
            x="1.6"
            y="1.6"
            width="6.8"
            height="6.8"
            rx="1"
            fill="none"
            stroke={c(theme.gray4)}
            strokeWidth="1.2"
          />
        </svg>
      );
  }
}
