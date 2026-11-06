import { z } from "zod";

/**
 * JSON contract for learning roadmaps. Roadmaps are generated outside the app (by Claude
 * Code) and imported with `npm run roadmap:import <file.json>`. See
 * `docs/roadmap-json-contract.md` for the prompt-ready description.
 */

export const ROADMAP_PRIORITIES = ["essential", "recommended", "optional"] as const;
export type RoadmapPriority = (typeof ROADMAP_PRIORITIES)[number];

export const RESOURCE_KINDS = ["book", "course", "paper", "video", "code", "doc"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const NODE_STATUSES = ["todo", "doing", "done"] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

export const NODE_KINDS = ["stage", "item"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** Item nesting below a stage: an item may have children, which may have children. */
export const MAX_ITEM_DEPTH = 3;

export const LIMITS = {
  slug: 80,
  title: 120,
  topic: 120,
  summary: 500,
  description: 2000,
  url: 2000,
  stages: 30,
  itemsPerParent: 50,
  resourcesPerItem: 20,
  totalNodes: 1000,
} as const;

// NFC so the same title typed as composed or decomposed Unicode (e.g. Hangul) is one identity.
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .transform((s) => s.normalize("NFC"));
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

const httpUrl = z
  .string()
  .trim()
  .max(LIMITS.url)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "url must be an http(s) URL");

export const resourceSchema = z.object({
  title: text(LIMITS.title),
  url: httpUrl,
  kind: z.enum(RESOURCE_KINDS),
});
export type RoadmapResource = z.infer<typeof resourceSchema>;

export type RoadmapItemInput = {
  title: string;
  priority: RoadmapPriority;
  description: string;
  resources: RoadmapResource[];
  children: RoadmapItemInput[];
};

const itemSchemaAt = (depth: number): z.ZodType<RoadmapItemInput> => {
  const base = {
    title: text(LIMITS.title),
    priority: z.enum(ROADMAP_PRIORITIES),
    description: optionalText(LIMITS.description),
    resources: z.array(resourceSchema).max(LIMITS.resourcesPerItem).optional().default([]),
  };
  const children =
    depth < MAX_ITEM_DEPTH
      ? z
          .array(itemSchemaAt(depth + 1))
          .max(LIMITS.itemsPerParent)
          .optional()
          .default([])
      : z
          .array(z.never())
          .max(0, `items may nest at most ${MAX_ITEM_DEPTH} levels`)
          .optional()
          .default([]);
  return z.object({ ...base, children }) as unknown as z.ZodType<RoadmapItemInput>;
};

export const itemSchema = itemSchemaAt(1);

export const stageSchema = z.object({
  title: text(LIMITS.title),
  description: optionalText(LIMITS.description),
  items: z.array(itemSchema).max(LIMITS.itemsPerParent),
});
export type RoadmapStageInput = z.infer<typeof stageSchema>;

const countNodes = (items: RoadmapItemInput[]): number =>
  items.reduce((n, item) => n + 1 + countNodes(item.children), 0);

const uniqueTitles = (titles: string[]) => new Set(titles).size === titles.length;

export const roadmapSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(LIMITS.slug)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
    title: text(LIMITS.title),
    topic: text(LIMITS.topic),
    summary: optionalText(LIMITS.summary),
    stages: z.array(stageSchema).min(1).max(LIMITS.stages),
  })
  .superRefine((roadmap, ctx) => {
    const total = roadmap.stages.reduce((n, s) => n + 1 + countNodes(s.items), 0);
    if (total > LIMITS.totalNodes) {
      ctx.addIssue({ code: "custom", message: `at most ${LIMITS.totalNodes} nodes` });
    }
    // Titles are the identity used to keep status across re-imports, so siblings must differ.
    if (!uniqueTitles(roadmap.stages.map((s) => s.title))) {
      ctx.addIssue({ code: "custom", path: ["stages"], message: "stage titles must be unique" });
    }
    const checkItems = (items: RoadmapItemInput[], path: (string | number)[]) => {
      if (!uniqueTitles(items.map((i) => i.title))) {
        ctx.addIssue({ code: "custom", path, message: "sibling item titles must be unique" });
      }
      items.forEach((item, i) => checkItems(item.children, [...path, i, "children"]));
    };
    roadmap.stages.forEach((stage, i) => checkItems(stage.items, ["stages", i, "items"]));
  });

/** A validated roadmap document (defaults filled in). */
export type RoadmapInput = z.infer<typeof roadmapSchema>;

export type ParseResult = { ok: true; roadmap: RoadmapInput } | { ok: false; errors: string[] };

/** Validates an already-parsed JSON value against the contract. */
export function parseRoadmap(value: unknown): ParseResult {
  const result = roadmapSchema.safeParse(value);
  if (result.success) return { ok: true, roadmap: result.data };
  return {
    ok: false,
    errors: result.error.issues
      .slice(0, 20)
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
  };
}

/** Parses JSON text, then validates it. */
export function parseRoadmapJson(json: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, errors: ["(root): invalid JSON"] };
  }
  return parseRoadmap(value);
}

// ---- Read model returned by the repo (what screens consume) ----

export type LearningRoadmapSummary = {
  id: string;
  slug: string;
  title: string;
  topic: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  /** Item nodes (stages excluded). */
  itemCount: number;
  doneCount: number;
};

export type LearningRoadmapNode = {
  id: string;
  kind: NodeKind;
  title: string;
  description: string;
  /** Null for stages. */
  priority: RoadmapPriority | null;
  resources: RoadmapResource[];
  status: NodeStatus;
  position: number;
  children: LearningRoadmapNode[];
};

export type LearningRoadmapTree = Omit<LearningRoadmapSummary, "itemCount" | "doneCount"> & {
  itemCount: number;
  doneCount: number;
  /** Stage nodes in order; each holds its items as children. */
  stages: LearningRoadmapNode[];
};
