import Link from "next/link";
import { Badge, EmptyAdd } from "@/components/ui";
import { formatDue } from "@/components/tasks/format";
import { PROJECT_STATUS } from "@/lib/enums";
import type { Project } from "@/lib/repo/projects";

// Same row shape as 최근 생각/세미나 (title line, muted meta line) so the home reads as one rhythm.
const rowClass =
  "flex flex-col gap-1 rounded-md px-3 py-2.5 transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Active general (non-research) projects for the home "프로젝트" section, soonest due first. */
export function GeneralProjects({ projects, today }: { projects: Project[]; today: string }) {
  if (projects.length === 0) {
    return <EmptyAdd href="/projects/new?kind=general">＋ 새 프로젝트</EmptyAdd>;
  }
  return (
    <ul className="-mx-3 flex flex-col">
      {projects.map((p) => {
        const due = formatDue(p.dueDate, today);
        return (
          <li key={p.id}>
            <Link href={`/projects/${p.id}`} className={rowClass}>
              <span className="flex items-baseline justify-between gap-3">
                <span className="line-clamp-1 text-sm text-fg">{p.title}</span>
                {due ? (
                  <span className={due.className}>
                    <span aria-hidden="true">
                      {due.tone === "muted" ? `마감 ${due.text}` : due.text}
                    </span>
                    <span className="sr-only">{due.label}</span>
                  </span>
                ) : null}
              </span>
              {p.status !== "active" ? (
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <Badge tone={PROJECT_STATUS.tone(p.status)}>
                    {PROJECT_STATUS.label(p.status)}
                  </Badge>
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
