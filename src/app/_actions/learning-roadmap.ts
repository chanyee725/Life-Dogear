"use server";

import { revalidatePath } from "next/cache";
import { parseId } from "@/app/_actions/parse";
import { runAction, type ActionResult } from "@/app/_actions/result";
import { RepoError } from "@/lib/repo";
import {
  deleteRoadmap,
  isNodeStatus,
  setNodeStatus,
  type RoadmapNodeStatus,
} from "@/lib/repo/learningRoadmap";

const NOT_FOUND_NODE = "로드맵 항목을 찾을 수 없습니다.";
const NOT_FOUND_ROADMAP = "로드맵을 찾을 수 없습니다.";

function revalidate() {
  revalidatePath("/roadmap", "layout");
}

/** Sets a stage or item to todo / doing / done. */
export async function setRoadmapNodeStatus(
  nodeId: unknown,
  status: unknown,
): Promise<ActionResult<{ id: string; status: RoadmapNodeStatus }>> {
  return runAction(async () => {
    const id = parseId(nodeId);
    if (!isNodeStatus(status)) throw new RepoError("invalid", "상태 값이 올바르지 않습니다.");
    if (!(await setNodeStatus(id, status))) throw new RepoError("not_found", NOT_FOUND_NODE);
    revalidate();
    return { id, status };
  });
}

/** Deletes a whole learning roadmap with its stages and items. */
export async function deleteLearningRoadmap(roadmapId: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const id = parseId(roadmapId);
    if (!(await deleteRoadmap(id))) throw new RepoError("not_found", NOT_FOUND_ROADMAP);
    revalidate();
    return null;
  });
}
