import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  IMPORTANCE,
  ITEM_TYPE,
  PROJECT_KIND,
  PROJECT_STAGE,
  PROJECT_STATUS,
  READ_STATUS,
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
    archivedAt: archivedAt(),
    ...timestamps,
  },
  (t) => [index("areas_order_idx").on(t.archivedAt, t.sortOrder)],
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

/** Directed many-to-many link between any two items (creator → target). */
export const links = sqliteTable(
  "links",
  {
    id: text("id").primaryKey(),
    sourceType: text("source_type", { enum: ITEM_TYPE.values }).notNull(),
    sourceId: text("source_id").notNull(),
    targetType: text("target_type", { enum: ITEM_TYPE.values }).notNull(),
    targetId: text("target_id").notNull(),
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
