import Link from "next/link";
import type { Project, StageColumn } from "@/lib/repo/projects";
import { DashboardSection } from "./DashboardSection";
import { GeneralProjects } from "./GeneralProjects";
import { ProjectKanbanBoard } from "./ProjectKanban";
import { ProjectTabs } from "./ProjectTabs";

/** Home "진행 중인 프로젝트": [연구 칸반 | 그 외] tabs. Archived projects never appear. */
export function ActiveProjects({ stages, general }: { stages: StageColumn[]; general: Project[] }) {
  const researchCount = stages.reduce((sum, c) => sum + c.items.length, 0);
  return (
    <DashboardSection
      id="active-projects"
      title="진행 중인 프로젝트"
      action={
        <Link href="/projects" className="text-xs text-muted hover:text-fg">
          모두 보기
        </Link>
      }
    >
      <ProjectTabs
        counts={{ research: researchCount, general: general.length }}
        research={<ProjectKanbanBoard columns={stages} />}
        general={<GeneralProjects projects={general} />}
      />
    </DashboardSection>
  );
}
