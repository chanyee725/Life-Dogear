/**
 * Sample data for trying the app (`npm run db:seed`).
 * Only rows whose id starts with `seed-` are replaced; user data is left alone.
 * All people are fictional; no e-mail addresses.
 *
 * Runs with `--conditions=react-server` (so `server-only` resolves). Do not import
 * React or React-related modules here: they would load their server builds.
 */
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { like, or } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getDb, resolveDbConfig } from "../src/db/client";
import { loadEnvIfPresent } from "../src/db/env";
import { pdfDirSetting } from "../src/lib/data-dir";
import {
  areas,
  highlights,
  itemTags,
  links,
  papers,
  projects,
  seminars,
  thoughts,
} from "../src/db/schema";
import { PAPER_TEMPLATE, PROJECT_TEMPLATE, SEMINAR_TEMPLATE } from "../src/lib/templates";
import { pruneOrphanTags, setTagsWith } from "../src/lib/repo/tags";
import type { ItemRef } from "../src/lib/repo/shared";

const PREFIX = "seed-";
const PDF_PAGES = 10;

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
const daysFromNow = (d: number) => new Date(now + d * 86_400_000).toISOString().slice(0, 10);
const stamps = (h: number) => ({ createdAt: hoursAgo(h), updatedAt: hoursAgo(h / 2) });

const fill = (template: string, answers: Record<string, string>) =>
  Object.entries(answers).reduce(
    (md, [heading, text]) => md.replace(`${heading}\n\n`, `${heading}\n\n${text}\n`),
    template,
  );

// Fictional areas (the same titles as the recommended ones, with sample standards).
const areaRows: (typeof areas.$inferInsert)[] = [
  { title: "연구 분야", standard: "관심 분야의 새 논문·세미나를 꾸준히 따라간다." },
  { title: "학위", standard: "학기별 요건과 마감을 놓치지 않는다." },
  { title: "건강", standard: "잠·운동·식사를 무너지지 않게 유지한다." },
  { title: "커리어", standard: "이력과 다음 진로 선택지를 분기마다 정리한다." },
].map((a, i) => ({
  id: `seed-area-${i + 1}`,
  ...a,
  sortOrder: i,
  body: "",
  ...stamps(600 - i),
}));

const projectRows: (typeof projects.$inferInsert)[] = [
  {
    id: "seed-project-1",
    title: "대학원생 연구 노트 습관 연구",
    areaId: "seed-area-2",
    nextAction: "선행 연구 5편 요약 정리",
    researchQuestion: "디지털 노트 도구는 문헌 검토의 깊이에 어떤 영향을 주는가?",
    stage: "lit_review",
    startDate: daysFromNow(-60),
    dueDate: daysFromNow(45),
    body: PROJECT_TEMPLATE.replace("- [ ] 주제 탐색", "- [x] 주제 탐색").replace(
      "- [ ] 주제 확정",
      "- [x] 주제 확정",
    ),
    ...stamps(300),
  },
  {
    id: "seed-project-2",
    areaId: "seed-area-1",
    nextAction: "평가 지표 표 초안 만들기",
    title: "소규모 언어모델 요약 품질 비교",
    researchQuestion: "작은 모델도 도메인 요약에서 충분한 품질을 낼 수 있는가?",
    stage: "drafting",
    startDate: daysFromNow(-120),
    dueDate: daysFromNow(20),
    body: PROJECT_TEMPLATE,
    ...stamps(200),
  },
  {
    id: "seed-project-3",
    areaId: "seed-area-1",
    title: "온라인 세미나 참여 동기 탐색",
    researchQuestion: "",
    stage: "exploring",
    startDate: daysFromNow(-7),
    dueDate: null,
    body: PROJECT_TEMPLATE,
    ...stamps(100),
  },
  {
    id: "seed-project-4",
    title: "연구실 세미나 발표 준비",
    kind: "general",
    status: "active",
    areaId: "seed-area-4",
    nextAction: "발표 슬라이드 목차 정하기",
    startDate: daysFromNow(-5),
    dueDate: daysFromNow(10),
    body: "",
    ...stamps(40),
  },
];

const paperRows: (typeof papers.$inferInsert)[] = [
  {
    id: "seed-paper-1",
    title: "Note-Taking Tools and Depth of Literature Review",
    authors: JSON.stringify(["김가명", "Alex Placeholder"]),
    year: 2023,
    venue: "Journal of Sample Studies",
    doi: "10.0000/sample.0001",
    readStatus: "reading",
    importance: "core",
    summary: "노트 도구의 연결 기능이 문헌 검토의 깊이를 높인다는 주장.",
    lastPage: 4,
    lastScroll: 0.35,
    totalPages: PDF_PAGES,
    lastReadAt: hoursAgo(3),
    body: fill(PAPER_TEMPLATE, { "## 왜 읽나": "연구 1의 핵심 선행 연구 후보." }),
    ...stamps(400),
  },
  {
    id: "seed-paper-2",
    title: "Compact Language Models for Domain Summarization",
    authors: JSON.stringify(["이예시", "Sam Example", "박샘플"]),
    year: 2024,
    venue: "Proceedings of the Placeholder Conference",
    url: "https://example.org/papers/compact-summarization",
    readStatus: "reading",
    importance: "core",
    summary: "작은 모델에 도메인 적응을 하면 요약 품질 격차가 크게 줄어든다.",
    lastPage: 7,
    lastScroll: 0.6,
    totalPages: PDF_PAGES,
    lastReadAt: hoursAgo(26),
    body: PAPER_TEMPLATE,
    ...stamps(380),
  },
  {
    id: "seed-paper-3",
    title: "Evaluating Abstractive Summaries Without References",
    authors: JSON.stringify(["Jordan Sample"]),
    year: 2022,
    venue: "Sample Transactions",
    readStatus: "done",
    importance: "reference",
    summary: "참조 요약 없이 품질을 평가하는 지표 비교.",
    lastPage: PDF_PAGES,
    lastScroll: 1,
    totalPages: PDF_PAGES,
    lastReadAt: hoursAgo(240),
    body: PAPER_TEMPLATE,
    ...stamps(500),
  },
  {
    id: "seed-paper-4",
    title: "Motivation in Online Academic Events",
    authors: JSON.stringify(["최가상", "Robin Fiction"]),
    year: 2021,
    venue: "Example Review",
    readStatus: "to_read",
    importance: "reference",
    summary: "",
    body: PAPER_TEMPLATE,
    ...stamps(90),
  },
  {
    id: "seed-paper-5",
    archivedAt: hoursAgo(20), // sample archived item (보관함)
    title: "A Short History of Commonplace Books",
    authors: JSON.stringify(["정임시"]),
    year: 2019,
    venue: "Placeholder Press",
    readStatus: "to_read",
    importance: "light",
    summary: "",
    body: PAPER_TEMPLATE,
    ...stamps(60),
  },
];
const PAPERS_WITH_PDF = ["seed-paper-1", "seed-paper-2", "seed-paper-3"];

const seminarRows: (typeof seminars.$inferInsert)[] = [
  {
    id: "seed-seminar-1",
    title: "연구 노트와 지식 관리",
    date: daysFromNow(-3),
    speaker: "한가명 교수",
    hostVenue: "샘플대학교 인문관 301호",
    kind: "seminar",
    keyLine: "노트는 저장이 아니라 연결을 위한 것.",
    body: fill(SEMINAR_TEMPLATE, { "## 현장 메모": "질의응답에서 노트 도구 비교 이야기가 나옴." }),
    ...stamps(72),
  },
  {
    id: "seed-seminar-2",
    title: "작은 모델의 시대",
    date: daysFromNow(-14),
    speaker: "Casey Placeholder",
    hostVenue: "예시 학회 2026",
    kind: "talk",
    keyLine: "모델 크기보다 데이터 품질이 먼저다.",
    materialUrl: "https://example.org/slides/small-models",
    body: SEMINAR_TEMPLATE,
    ...stamps(340),
  },
  {
    id: "seed-seminar-3",
    title: "질적 연구 방법론 특강",
    date: daysFromNow(-30),
    speaker: "윤예시 박사",
    hostVenue: "온라인",
    kind: "seminar",
    keyLine: "인터뷰 질문은 짧고 열려 있게.",
    body: SEMINAR_TEMPLATE,
    ...stamps(720),
  },
];

const thoughtRows: (typeof thoughts.$inferInsert)[] = [
  {
    id: "seed-thought-1",
    title: "노트 연결 수와 논문 인용 다양성의 상관?",
    kind: "question",
    maturity: "seed",
    body: "연결이 많은 노트를 가진 사람이 더 다양한 문헌을 인용할까?",
    ...stamps(5),
  },
  {
    id: "seed-thought-2",
    title: "요약 평가에 사람 평가를 꼭 넣어야 함",
    kind: "critique",
    maturity: "growing",
    body: "자동 지표만으로는 도메인 정확성을 놓친다.",
    ...stamps(30),
  },
  {
    id: "seed-thought-3",
    title: "세미나 1과 논문 1이 같은 이야기를 한다",
    kind: "connection",
    maturity: "growing",
    body: "둘 다 '연결'을 핵심으로 본다. 연구 1의 이론적 배경으로 묶을 수 있음.",
    ...stamps(50),
  },
  {
    id: "seed-thought-4",
    title: "온라인 세미나 참여 로그를 데이터로 쓰기",
    kind: "idea",
    maturity: "seed",
    body: "",
    ...stamps(80),
  },
  {
    id: "seed-thought-5",
    title: "다음 주 지도 교수 미팅 준비",
    kind: "memo",
    maturity: "refined",
    body: "- 연구 2 초안 진행 상황\n- 평가 방법 질문",
    ...stamps(10),
  },
];

const tagAssignments: [ItemRef, string[]][] = [
  [{ type: "project", id: "seed-project-1" }, ["지식관리", "질적연구"]],
  [{ type: "project", id: "seed-project-2" }, ["NLP", "요약"]],
  [{ type: "project", id: "seed-project-3" }, ["질적연구"]],
  [{ type: "paper", id: "seed-paper-1" }, ["지식관리"]],
  [{ type: "paper", id: "seed-paper-2" }, ["NLP", "요약"]],
  [{ type: "paper", id: "seed-paper-3" }, ["NLP", "평가"]],
  [{ type: "paper", id: "seed-paper-4" }, ["질적연구"]],
  [{ type: "seminar", id: "seed-seminar-1" }, ["지식관리"]],
  [{ type: "seminar", id: "seed-seminar-2" }, ["NLP"]],
  [{ type: "seminar", id: "seed-seminar-3" }, ["질적연구"]],
  [{ type: "thought", id: "seed-thought-2" }, ["평가"]],
  // seed-thought-1 and seed-thought-4 stay untagged and unlinked: they are the inbox.
  [{ type: "thought", id: "seed-thought-5" }, ["미팅"]],
  [{ type: "area", id: "seed-area-1" }, ["NLP"]],
];

const linkPairs: [ItemRef, ItemRef][] = [
  [
    { type: "seminar", id: "seed-seminar-2" },
    { type: "area", id: "seed-area-1" },
  ],
  [
    { type: "paper", id: "seed-paper-1" },
    { type: "project", id: "seed-project-1" },
  ],
  [
    { type: "paper", id: "seed-paper-2" },
    { type: "project", id: "seed-project-2" },
  ],
  [
    { type: "paper", id: "seed-paper-3" },
    { type: "project", id: "seed-project-2" },
  ],
  [
    { type: "seminar", id: "seed-seminar-1" },
    { type: "paper", id: "seed-paper-1" },
  ],
  [
    { type: "seminar", id: "seed-seminar-2" },
    { type: "project", id: "seed-project-2" },
  ],
  [
    { type: "thought", id: "seed-thought-3" },
    { type: "seminar", id: "seed-seminar-1" },
  ],
  [
    { type: "thought", id: "seed-thought-3" },
    { type: "paper", id: "seed-paper-1" },
  ],
  [
    { type: "thought", id: "seed-thought-2" },
    { type: "paper", id: "seed-paper-3" },
  ],
];

async function makeDummyPdf(title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= PDF_PAGES; i++) {
    const page = doc.addPage([595, 842]); // A4
    page.drawText(title, { x: 56, y: 770, size: 16, font: bold, maxWidth: 480 });
    page.drawText(`Sample PDF for Research Brain - page ${i} of ${PDF_PAGES}`, {
      x: 56,
      y: 740,
      size: 10,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
    for (let line = 0; line < 40; line++) {
      page.drawText(
        `Section ${i}.${line + 1}  This is placeholder text used to test scrolling and resume reading.`,
        { x: 56, y: 700 - line * 16, size: 10, font },
      );
    }
    page.drawText(String(i), { x: 290, y: 40, size: 10, font });
  }
  return doc.save();
}

async function main() {
  loadEnvIfPresent();
  const PDF_DIR = pdfDirSetting(); // <DATA_DIR>/pdfs, read after env files load
  const target = resolveDbConfig().url.startsWith("file:") ? "local file" : "Turso";
  const db = getDb();
  await migrate(db, { migrationsFolder: "drizzle" });

  await db.transaction(async (tx) => {
    const seeded = `${PREFIX}%`;
    await tx.delete(links).where(or(like(links.sourceId, seeded), like(links.targetId, seeded)));
    await tx.delete(itemTags).where(like(itemTags.itemId, seeded));
    await tx.delete(highlights).where(like(highlights.paperId, seeded));
    for (const table of [projects, papers, seminars, thoughts]) {
      await tx.delete(table).where(like(table.id, seeded));
    }
    // User projects may sit in a sample area: unassign before removing the areas.
    await tx.update(projects).set({ areaId: null }).where(like(projects.areaId, seeded));
    await tx.delete(areas).where(like(areas.id, seeded));
    await pruneOrphanTags(tx);

    await tx.insert(areas).values(areaRows);
    await tx.insert(projects).values(projectRows);
    await tx.insert(papers).values(
      paperRows.map((p) => ({
        ...p,
        pdfPath: PAPERS_WITH_PDF.includes(p.id) ? `${PDF_DIR}/${p.id}.pdf` : null,
      })),
    );
    await tx.insert(seminars).values(seminarRows);
    await tx.insert(thoughts).values(thoughtRows);
    for (const [ref, names] of tagAssignments) await setTagsWith(tx, ref, names);
    await tx.insert(links).values(
      linkPairs.map(([a, b], i) => ({
        id: `${PREFIX}link-${i + 1}`,
        sourceType: a.type,
        sourceId: a.id,
        targetType: b.type,
        targetId: b.id,
        createdAt: hoursAgo(48 - i),
      })),
    );
  });

  await mkdir(PDF_DIR, { recursive: true });
  for (const file of await readdir(PDF_DIR)) {
    if (file.startsWith(PREFIX) && file.endsWith(".pdf")) await unlink(join(PDF_DIR, file));
  }
  for (const id of PAPERS_WITH_PDF) {
    const title = paperRows.find((p) => p.id === id)!.title;
    await writeFile(join(PDF_DIR, `${id}.pdf`), await makeDummyPdf(title));
  }

  console.log(
    `Seeded (${target}): ${areaRows.length} areas, ${projectRows.length} projects, ${paperRows.length} papers, ` +
      `${seminarRows.length} seminars, ${thoughtRows.length} thoughts, ${linkPairs.length} links, ` +
      `${PAPERS_WITH_PDF.length} dummy PDFs.`,
  );
}

main().catch((err) => {
  // Name/code only: driver messages can include query params.
  const code = (err as { code?: unknown })?.code;
  console.error(
    `Seed failed: ${err instanceof Error ? err.name : "unknown error"}${code ? ` (${String(code)})` : ""}`,
  );
  process.exit(1);
});
