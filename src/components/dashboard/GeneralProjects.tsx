import Link from "next/link";
import { Badge } from "@/components/ui";
import { PROJECT_STATUS } from "@/lib/enums";
import type { Project } from "@/lib/repo/projects";
import { DashboardAdd } from "./DashboardSection";
import { formatDate } from "./format";
import { NextAction } from "./NextAction";

/** Active general (non-research) projects for the home "프로젝트" section, soonest due first. */
export function GeneralProjects({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return <DashboardAdd href="/projects/new?kind=general">＋ 새 프로젝트</DashboardAdd>;
  }
  return (
    <ul className="-mx-3 flex flex-col">
      {projects.map((p) => (
        <li key={p.id}>
          <Link
            href={`/projects/${p.id}`}
            className="flex flex-col gap-1 rounded-md px-3 py-2.5 transition-colors hover:bg-surface focus-visible:bg-surface"
          >
            <span className="flex items-center gap-2">
              <span className="line-clamp-1 text-sm text-fg">{p.title}</span>
              {p.status !== "active" ? (
                <Badge tone={PROJECT_STATUS.tone(p.status)}>{PROJECT_STATUS.label(p.status)}</Badge>
              ) : null}
              {p.dueDate ? (
                <span className="ml-auto shrink-0 text-xs text-muted tabular-nums">
                  마감 {formatDate(p.dueDate)}
                </span>
              ) : null}
            </span>
            <NextAction value={p.nextAction} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
