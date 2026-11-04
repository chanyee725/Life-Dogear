import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  GOAL_HORIZON,
  GOAL_PROGRESS_MODE,
  GOAL_STATUS,
  IMPORTANCE,
  ITEM_TYPE,
  LINK_VIA,
  NOTE_SOURCE_KIND,
  PROJECT_KIND,
  PROJECT_STAGE,
  PROJECT_STATUS,
  READ_STATUS,
  REVIEW_KIND,
  SEMINAR_KIND,
  THOUGHT_KIND,
  THOUGHT_MATURITY,
} from "@/lib/enums";

// Timestamps are ISO 8601 UTC strings; date-only fields are `YYYY-MM-DD`.
const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

/** Set when the user archives an item; archived items are hidden from lists by default. */
const archivedAt = () => text("archived_at");

/** PARA areas: ongoing responsibilities with a standard to maintain. */
export const areas = sqliteTable(
  "areas",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    /** "유지 기준": what keeping this area healthy means. */
    standard: text("standard").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    body: text("body").notNull().default(""),
    /** Unused: sidebar pinning was tried and dropped (the sidebar has one 영역 entry). Kept so the migration-0005 column stays mapped. */
    pinnedAt: text("pinned_at"),
    archivedAt: archivedAt(),
    ...timestamps,
  },
  (t) => [index("areas_order_idx").on(t.archivedAt, t.sortOrder)],
);

/** Goals: life (no period) → year (`2027`) → quarter (`2027-Q1`). */
export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    why: text("why").notNull().default(""),
    horizon: text("horizon", { enum: GOAL_HORIZON.values }).notNull(),
    /** Null for life goals. */
    period: text("period"),
    parentId: text("parent_id").references((): AnySQLiteColumn => goals.id, {
      onDelete: "set null",
    }),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    status: text("status", { enum: GOAL_STATUS.values }).notNull().default("active"),
    progressMode: text("progress_mode", { enum: GOAL_PROGRESS_MODE.values })
      .notNull()
      .default("auto"),
    /** 0..100, used when `progressMode` is manual. */
    manualProgress: integer("manual_progress"),
    body: text("body").notNull().default(""),
    archivedAt: archivedAt(),
    ...timestamps,
  },
  (t) => [
    index("goals_period_idx").on(t.period),
    index("goals_parent_idx").on(t.parentId),
    index("goals_area_idx").on(t.areaId),
  ],
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    kind: text("kind", { enum: PROJECT_KIND.values }).notNull().default("research"),
    /** General projects use this; research projects keep it in sync with `stage`. */
    status: text("status", { enum: PROJECT_STATUS.values }).notNull().default("active"),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    nextAction: text("next_action").notNull().default(""),
    researchQuestion: text("research_question").notNull().default(""),
    stage: text("stage", { enum: PROJECT_STAGE.values }).notNull().default("exploring"),
    startDate: text("start_date"),
    dueDate: text("due_date"),
    completedAt: text("completed_at"),
    body: text("body").notNull().default(""),
    archivedAt: archivedAt(),
    ...timestamps,
  },
  (t) => [
    index("projects_kind_status_idx").on(t.kind, t.status, t.archivedAt),
    index("projects_area_idx").on(t.areaId),
    index("projects_goal_idx").on(t.goalId),
  ],
);

export const papers = sqliteTable(
  "papers",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    /** JSON array of author names. */
    authors: text("authors").notNull().default("[]"),
    year: integer("year"),
    venue: text("venue").notNull().default(""),
    doi: text("doi").notNull().default(""),
    url: text("url").notNull().default(""),
    pdfPath: text("pdf_path"),
    readStatus: text("read_status", { enum: READ_STATUS.values }).notNull().default("to_read"),
    importance: text("importance", { enum: IMPORTANCE.values }).notNull().default("reference"),
    summary: text("summary").notNull().default(""),
    lastPage: integer("last_page"),
    /** Position within the last page, 0..1. */
    lastScroll: real("last_scroll"),
    totalPages: integer("total_pages"),
    lastReadAt: text("last_read_at"),
    body: text("body").notNull().default(""),
    archivedAt: archivedAt(),
    ...timestamps,
  },
  (t) => [
    index("papers_continue_reading_idx").on(t.readStatus, t.lastReadAt),
    index("papers_archived_idx").on(t.archivedAt),
  ],
);

export const seminars = sqliteTable(
  "seminars",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    date: text("date"),
    speaker: text("speaker").notNull().default(""),
    hostVenue: text("host_venue").notNull().default(""),
    kind: text("kind", { enum: SEMINAR_KIND.values }).notNull().default("seminar"),
    keyLine: text("key_line").notNull().default(""),
    materialUrl: text("material_url").notNull().default(""),
    body: text("body").notNull().default(""),
    archivedAt: archivedAt(),
    ...timestamps,
  },
  (t) => [index("seminars_archived_idx").on(t.archivedAt)],
);

export const thoughts = sqliteTable(
  "thoughts",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    kind: text("kind", { enum: THOUGHT_KIND.values }).notNull().default("memo"),
    maturity: text("maturity", { enum: THOUGHT_MATURITY.values }).notNull().default("seed"),
    body: text("body").notNull().default(""),
    archivedAt: archivedAt(),
    ...timestamps,
  },
  (t) => [index("thoughts_archived_idx").on(t.archivedAt)],
);

/** Study notes (노트): what was learned from a book, lecture, video or article. Migration 0007. */
export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    /** Null = not said. */
    sourceKind: text("source_kind", { enum: NOTE_SOURCE_KIND.values }),
    sourceTitle: text("source_title"),
    /** http(s) only (checked in the repo). */
    sourceUrl: text("source_url"),
    /** Area the note belongs to; projects are connected with links. */
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    archivedAt: archivedAt(),
    ...timestamps,
  },
  (t) => [index("notes_archived_idx").on(t.archivedAt), index("notes_area_idx").on(t.areaId)],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("tags_name_nocase_idx").on(sql`lower(${t.name})`)],
);

export const itemTags = sqliteTable(
  "item_tags",
  {
    itemType: text("item_type", { enum: ITEM_TYPE.values }).notNull(),
    itemId: text("item_id").notNull(),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.itemType, t.itemId, t.tagId] }),
    index("item_tags_tag_idx").on(t.tagId),
  ],
);

/**
 * Directed many-to-many link between any two items (creator → target).
 * One link per pair regardless of direction or `via`: a `manual` link is never
 * touched by body sync, and linking a `body` pair by hand promotes it to `manual`.
 */
export const links = sqliteTable(
  "links",
  {
    id: text("id").primaryKey(),
    sourceType: text("source_type", { enum: ITEM_TYPE.values }).notNull(),
    sourceId: text("source_id").notNull(),
    targetType: text("target_type", { enum: ITEM_TYPE.values }).notNull(),
    targetId: text("target_id").notNull(),
    via: text("via", { enum: LINK_VIA.values }).notNull().default("manual"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("links_pair_idx").on(t.sourceType, t.sourceId, t.targetType, t.targetId),
    index("links_target_idx").on(t.targetType, t.targetId),
  ],
);

/** Schema only in phase 1; the highlight UI comes in phase 2. */
export const highlights = sqliteTable(
  "highlights",
  {
    id: text("id").primaryKey(),
    paperId: text("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    page: integer("page").notNull(),
    text: text("text").notNull(),
    color: text("color").notNull().default("yellow"),
    note: text("note").notNull().default(""),
    /** JSON array of rectangles in page coordinates. */
    rects: text("rects").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("highlights_paper_idx").on(t.paperId, t.page)],
);

/** Reviews (회고): one per kind + period, e.g. week `2026-W45`. */
export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: REVIEW_KIND.values }).notNull(),
    period: text("period").notNull(),
    /** Display title (e.g. "2026-W45 주간 회고"); used by links, search and `[[…]]`. */
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    /** JSON array of ItemRef (weekly focus, ≤3). */
    focus: text("focus").notNull().default("[]"),
    /** JSON object {goalId: 0..100} snapshot at writing time. */
    goalProgress: text("goal_progress").notNull().default("{}"),
    completedAt: text("completed_at"),
    archivedAt: archivedAt(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("reviews_kind_period_idx").on(t.kind, t.period),
    index("reviews_archived_idx").on(t.archivedAt),
  ],
);

/** Graph node kinds: every item type plus tag (topic) and task nodes. */
export const GRAPH_NODE_TYPES = [...ITEM_TYPE.values, "tag", "task"] as const;

/** Pinned node positions on `/graph` (the only graph-specific table). */
export const graphLayout = sqliteTable(
  "graph_layout",
  {
    /** An item type or "tag" (tag nodes use the tag id). */
    nodeType: text("node_type", { enum: GRAPH_NODE_TYPES }).notNull(),
    nodeId: text("node_id").notNull(),
    x: real("x").notNull(),
    y: real("y").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.nodeType, t.nodeId] })],
);

/**
 * "중요" stars for the cosmos view's importance score. One row per starred item; removed
 * with the item (`removeLinksFor`). A separate table so item tables stay untouched.
 */
export const itemStars = sqliteTable(
  "item_stars",
  {
    itemType: text("item_type", { enum: ITEM_TYPE.values }).notNull(),
    itemId: text("item_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.itemType, t.itemId] })],
);

/** Who a task belongs to; tasks without a parent sit in the task inbox. */
export const TASK_PARENT_TYPES = ["project", "goal", "area"] as const;

/**
 * Tasks (할 일). Not an item type: no detail page, links or tags. The parent is a plain
 * (type, id) pair without FK; `links.removeLinksFor` deletes a parent's tasks.
 */
export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    /** Completion time; null = open. */
    doneAt: text("done_at"),
    dueDate: text("due_date"),
    parentType: text("parent_type", { enum: TASK_PARENT_TYPES }),
    parentId: text("parent_id"),
    /** Order among tasks of the same parent. */
    sortOrder: integer("sort_order").notNull(),
    /** Reserved: tasks are hidden with an archived parent (computed), never archived alone. */
    archivedAt: archivedAt(),
    ...timestamps,
  },
  (t) => [
    index("tasks_parent_idx").on(t.parentType, t.parentId, t.sortOrder),
    index("tasks_due_idx").on(t.doneAt, t.dueDate),
  ],
);
