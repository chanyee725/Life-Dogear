import { Badge } from "@/components/ui/Badge";
import { PROJECT_STAGE, PROJECT_STATUS } from "@/lib/enums";
import type { Project } from "@/lib/repo/projects";

/** Stage badge for research projects, status badge for general ones. */
export function ProgressBadge({ project }: { project: Project }) {
  return project.kind === "research" ? (
    <Badge tone={PROJECT_STAGE.tone(project.stage)}>{PROJECT_STAGE.label(project.stage)}</Badge>
  ) : (
    <Badge tone={PROJECT_STATUS.tone(project.status)}>{PROJECT_STATUS.label(project.status)}</Badge>
  );
}
