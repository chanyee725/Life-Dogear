import Link from "next/link";
import { Badge, EmptyAdd, cardClass, cardLinkClass, cn } from "@/components/ui";
import { PROJECT_STATUS } from "@/lib/enums";
import type { Project } from "@/lib/repo/projects";
import { dueChip, progressPercent } from "./project-card";

export type ProjectProgress = { done: number; total: number };

// Corners, padding and type size match the "진행 중인 연구" kanban cards (ProjectKanban.tsx).
const cardLink = cn(
  cardClass,
  cardLinkClass,
  "flex h-full flex-col gap-2 rounded-md p-3 text-sm",
  "focus-visible:ring-2 focus-visible:ring-ring",
);

const gridClass = "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3";

/**
 * Active general (non-research) projects for the home "프로젝트" section as a card grid,
 * soonest due first. A lone project keeps its grid-cell width.
 *
 * `progress` (task done/total) and `context` (linked goal or area title) are keyed by
 * project id; a card leaves out whatever is missing.
 */
export function GeneralProjects({
  projects,
  today,
  progress,
  context,
}: {
  projects: Project[];
  today: string;
  progress?: Record<string, ProjectProgress>;
  context?: Record<string, string>;
}) {
  if (projects.length === 0) {
    return (
      <div className={gridClass}>
        <EmptyAdd href="/projects/new?kind=general" className="rounded-md">
          ＋ 새 프로젝트
        </EmptyAdd>
      </div>
    );
  }
  return (
    <ul className={gridClass}>
      {projects.map((p) => (
        <li key={p.id}>
          <ProjectCard
            project={p}
            today={today}
            progress={progress?.[p.id]}
            context={context?.[p.id]}
          />
        </li>
      ))}
    </ul>
  );
}

function ProjectCard({
  project: p,
  today,
  progress,
  context,
}: {
  project: Project;
  today: string;
  progress?: ProjectProgress;
  context?: string;
}) {
  const due = dueChip(p.dueDate, today);
  return (
    <Link href={`/projects/${p.id}`} className={cardLink}>
      <span className="line-clamp-2 font-semibold text-fg">{p.title}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge tone={PROJECT_STATUS.tone(p.status)}>{PROJECT_STATUS.label(p.status)}</Badge>
        {due ? (
          <Badge tone={due.tone} className="tabular-nums">
            <span aria-hidden="true">{due.text}</span>
            <span className="sr-only">{due.label}</span>
          </Badge>
        ) : null}
      </span>
      {context ? (
        <span className="line-clamp-1 text-xs text-muted-foreground">{context}</span>
      ) : null}
      {progress && progress.total > 0 ? <TaskProgress {...progress} /> : null}
    </Link>
  );
}

function TaskProgress({ done, total }: ProjectProgress) {
  const pct = progressPercent(done, total);
  return (
    <span className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
      <span
        role="progressbar"
        aria-label="할 일 진행"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`할 일 ${total}개 중 ${done}개 완료`}
        className="h-1 flex-1 overflow-hidden rounded-full bg-subtle"
      >
        <span className="block h-full rounded-full bg-fg/60" style={{ width: `${pct}%` }} />
      </span>
      <span aria-hidden="true" className="tabular-nums">
        {done}/{total}
      </span>
    </span>
  );
}
