import Link from "next/link";
import type { Project, StageColumn } from "@/lib/repo/projects";
import { Section } from "@/components/ui";
import { GeneralProjects } from "./GeneralProjects";
import { ProjectKanbanBoard } from "./ProjectKanban";

const allLink = (href: string) => (
  <Link href={href} className="text-xs text-muted hover:text-fg">
    모두 보기
  </Link>
);

/** Home "진행 중인 연구": research projects on the stage kanban. Archived ones never appear. */
export function ActiveResearch({ stages }: { stages: StageColumn[] }) {
  return (
    <Section id="active-research" title="진행 중인 연구" action={allLink("/projects")}>
      <ProjectKanbanBoard columns={stages} />
    </Section>
  );
}

/** Home "프로젝트": active general (non-research) projects, soonest due first. */
export function ActiveGeneralProjects({ projects }: { projects: Project[] }) {
  return (
    <Section id="active-projects" title="프로젝트" action={allLink("/projects?kind=general")}>
      <GeneralProjects projects={projects} />
    </Section>
  );
}
