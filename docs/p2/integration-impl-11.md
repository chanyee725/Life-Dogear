# impl-11 — 1팀 파일에 필요한 변경 (2단계 통합용)

2팀(impl-11)이 새 파일로 만든 기능을 1단계 화면에 붙이려면 아래 기존 파일 변경이 필요하다.
모두 1팀 소유 파일이라 직접 고치지 않았다. 스키마·package.json 변경은 없다.

기준 코드: **1팀 develop `bccec15`(1.5단계)**가 병합된 develop-p2 `b7ac924`. 1.5에서 논문 상세 헤더에
`ArchivePaperButton`(보관/보관 해제)과 보관 안내 줄이 추가됐고, 논문 상세 공용 부품(`DetailHeader`·`SaveStatus`·
`TitleInput`·`DetailBody`, `@/components/fields/save-queue`)과 읽기 화면 `toolbarEnd={<FocusModeToggle />}`는 그대로다.
아래 diff는 모두 확인용 브랜치 `p2/preview-2`(병합 금지)에 실제로 적용한 것을 옮겼고 `tsc --noEmit`·`eslint`·
`prettier --check`, 단일 테스트 `papers-actions`·`shell-shortcuts`·`search-palette` 통과를 확인했다(2026-11-02).
이번 기준에서 브라우저 확인은 하지 않았다(이전 `p2/preview` `04097a1`에서는 브라우저로 확인).
2팀 새 코드는 save-queue를 쓰지 않는다.

## A. DOI/arXiv "링크로 채우기"

새 파일: `src/lib/metadata/**`, `src/app/_actions/metadata.ts`(서버 액션 `lookupPaperMetadata`),
`src/components/metadata/FillFromLink.tsx`, `src/components/metadata/apply.ts`.

### A-1. `src/app/papers/_components/NewPaperForm.tsx` — 새 논문 폼 맨 위에 끼우기

입력란은 비제어(uncontrolled)이므로 `applyMetadataToForm`으로 `name`별 값을 넣고,
`AuthorsField`는 내부 상태를 가지므로 `key`를 바꿔 새 목록으로 다시 마운트한다.
가져온 값은 해당 필드를 **덮어쓴다**(사용자가 버튼을 눌러 요청한 동작).

```diff
@@ -2,5 +2,7 @@
 
 import Link from "next/link";
-import { startTransition, useActionState } from "react";
+import { startTransition, useActionState, useRef, useState } from "react";
+import { FillFromLink } from "@/components/metadata/FillFromLink";
+import { applyMetadataToForm } from "@/components/metadata/apply";
 import { safeAction } from "@/components/links/safe-action";
 import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
@@ -14,4 +16,9 @@ import { AuthorsField } from "./AuthorsField";
 
 export function NewPaperForm({ tagSuggestions }: { tagSuggestions: string[] }) {
+  const formRef = useRef<HTMLFormElement>(null);
+  const [authors, setAuthors] = useState<{ version: number; list: string[] }>({
+    version: 0,
+    list: [],
+  });
   // safeAction turns a crashed or unreachable action into an inline error (redirects pass through).
   const [state, action, pending] = useActionState(
@@ -23,4 +30,5 @@ export function NewPaperForm({ tagSuggestions }: { tagSuggestions: string[] }) {
   return (
     <form
+      ref={formRef}
       // Submitting manually (not `action={...}`) keeps the fields when saving fails:
       // React resets uncontrolled forms after a form action.
@@ -32,4 +40,12 @@ export function NewPaperForm({ tagSuggestions }: { tagSuggestions: string[] }) {
       className="flex flex-col gap-8"
     >
+      <FillFromLink
+        onFill={(meta) => {
+          if (formRef.current) applyMetadataToForm(formRef.current, meta);
+          if (meta.authors.length) {
+            setAuthors((prev) => ({ version: prev.version + 1, list: meta.authors }));
+          }
+        }}
+      />
       <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
         <Field label="제목" htmlFor="paper-title" className="sm:col-span-2">
@@ -37,5 +53,10 @@ export function NewPaperForm({ tagSuggestions }: { tagSuggestions: string[] }) {
         </Field>
         <Field label="저자" htmlFor="paper-authors" className="sm:col-span-2">
-          <AuthorsField id="paper-authors" name="authors" />
+          <AuthorsField
+            key={authors.version}
+            id="paper-authors"
+            name="authors"
+            defaultValue={authors.list}
+          />
         </Field>
         <Field label="연도" htmlFor="paper-year">
```

### A-2. `src/app/papers/_components/PaperEditor.tsx` — 논문 상세(선택)

제목 블록(1.5의 보관 안내 줄 포함) 아래, `<Properties>` 위에 넣는다. 자동 저장 큐가 있으므로 `change(f)`로 넣으면 그대로 저장되고
(서버 값과 같은 필드는 저장하지 않음), 비제어 입력(저자·연도·학술지·DOI·링크)은 `fillVersion` 키로 다시
마운트해 새 값을 보여준다. `TextField` props는 그대로다.

```diff
@@ -10,4 +10,6 @@ import { useUnsavedChangesGuard } from "@/components/fields/useUnsavedChangesGua
 import { DetailBody, DetailHeader, SaveStatus, TitleInput } from "@/components/fields/ItemDetail";
 import { Properties, Property } from "@/components/fields/Properties";
+import { FillFromLink } from "@/components/metadata/FillFromLink";
+import { metadataToFields } from "@/components/metadata/apply";
 import { Button, buttonClass, cn, Input } from "@/components/ui";
 import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
@@ -58,4 +60,15 @@ export function PaperEditor({
   const [error, setError] = useState<string | null>(null);
   const [titleEmpty, setTitleEmpty] = useState(false);
+  // "링크로 채우기": filled values replace the defaults; uncontrolled fields remount.
+  const [fillVersion, setFillVersion] = useState(0);
+  const [filled, setFilled] = useState<Partial<PatchInput>>({});
+  const current = {
+    authors: paper.authors,
+    year: paper.year?.toString() ?? "",
+    venue: paper.venue,
+    doi: paper.doi,
+    url: paper.url,
+    ...filled,
+  };
   const [yearInvalid, setYearInvalid] = useState(false);
   const paperId = paper.id;
@@ (제목 블록 — 보관 안내·오류·TitleInput을 감싼 </div> — 다음, <Properties> 앞)
       </div>
 
+      <FillFromLink
+        onFill={(meta) => {
+          const f = metadataToFields(meta);
+          setTitle(f.title);
+          setTitleEmpty(false);
+          setFilled((prev) => ({ ...prev, ...f }));
+          setFillVersion((v) => v + 1);
+          change(f);
+        }}
+      />
+
       <Properties>
         <Property label="저자" htmlFor="paper-authors">
           <AuthorsField
+            key={`authors-${fillVersion}`}
             id="paper-authors"
-            defaultValue={paper.authors}
+            defaultValue={current.authors}
             onCommit={(authors) => {
               if (authors.join("\n") !== (queue.pending().authors ?? paper.authors).join("\n")) {
@@
         </Property>
         <TextField
+          key={`year-${fillVersion}`}
           id="paper-year"
           label="연도"
-          defaultValue={paper.year?.toString() ?? ""}
+          defaultValue={current.year}
           inputMode="numeric"
           placeholder="2024"
@@
         />
         <TextField
+          key={`venue-${fillVersion}`}
           id="paper-venue"
           label="학술지·학회"
-          defaultValue={paper.venue}
+          defaultValue={current.venue}
           onChange={(venue) => change({ venue })}
         />
         <TextField
+          key={`doi-${fillVersion}`}
           id="paper-doi"
           label="DOI"
-          defaultValue={paper.doi}
+          defaultValue={current.doi}
           placeholder="10.xxxx/xxxxx"
           onChange={(doi) => change({ doi })}
         />
         <TextField
+          key={`url-${fillVersion}`}
           id="paper-url"
           label="링크"
-          defaultValue={paper.url}
+          defaultValue={current.url}
           placeholder="https://"
           onChange={(url) => change({ url })}
```

- 저장되기 전 이탈은 기존 `useUnsavedChangesGuard`가 막는다.
- 링크 필드 옆 "열기 ↗"는 저장된 `paper.url` 기준 그대로다(다음 새로고침부터 새 링크).
- 보관/보관 해제 버튼은 `router.refresh()`로 `paper` prop을 새로 받는다. 채운 값(`filled`)은 상태로 남고, 기존
  `queue.resetBaseline(serverValues(paper))` 효과가 저장된 값을 기준선으로 다시 잡으므로 충돌하지 않는다.

> 상세 화면 통합은 선택 사항이다. 우선 A-1(새 논문 폼)만 붙여도 SPEC §6 요구는 충족된다.

### 서버 진입점 메모

- 라우트 핸들러 대신 서버 액션(`src/app/_actions/metadata.ts`)을 썼다. Next.js 서버 액션은 Origin/Host를
  자체 검사하고, 전역 `middleware.ts`의 host-guard도 그대로 적용된다.
- 외부 호출은 서버에서 고정 호스트(`api.crossref.org`, `export.arxiv.org`)로만 한다. 입력은 DOI/arXiv 정규식을
  통과한 값만 경로·쿼리에 넣는다(SSRF 없음). 입력값은 로그에 남기지 않는다(오류 코드·HTTP 상태만).
- User-Agent: `ResearchBrain/0.1 (personal research notes app)` — 이메일/연락처 없음.
  (Crossref는 `mailto`를 넣으면 "polite pool"로 우대하지만, 개인정보 규칙에 따라 넣지 않았다.)

## B. 라이너 스콜라 메모 · 라이너에서 열기

새 파일: `src/lib/liner/**`(마크다운 섹션 조작 순수 함수, `buildLinerSearchUrl`),
`src/app/_actions/liner.ts`(서버 액션 `addLinerMemo`), `src/components/liner/**`
(`LinerMemoDialog`, `OpenInLiner`, `serverLinerMemoSubmit`). 스키마 변경 없음 — 본문 마크다운의
`## 라이너 스콜라 메모` 섹션(새 논문 양식에 이미 있음)에 추가하고, 없으면 본문 끝에 만든다.

저장 형식(항목 하나):

```md
### 하이라이트 · 2026-11-02

> 붙여넣은 내용(줄마다 인용 처리 — 안의 `## …`가 섹션을 깨지 않음)

출처: [liner.com](https://liner.com/…)   ← 링크 이름은 실제 호스트, 링크가 없으면 "출처: 라이너 스콜라"
```

### B-1. `src/app/papers/_components/PaperEditor.tsx` — `DetailHeader` 액션에 두 버튼 추가

1.5에서 헤더 액션이 `[보관] [삭제] [저장]`이 됐다. 라이너 버튼 두 개는 **보관 버튼 앞**에 넣는다 →
`[라이너에서 열기 ↗] [라이너 메모 붙여넣기] [보관] [삭제] [저장]`. 라이너 버튼은 논문 내용에 대한 동작이고
보관·삭제는 항목 자체의 상태 변경이라 묶어서 오른쪽(저장 옆)에 두는 편이 읽기 쉽다.

상세 화면은 본문을 편집기 상태(`body`)와 자동 저장 큐로 들고 있다. 서버에서 본문을 바꾸면 대기 중인
본문 저장이 그것을 덮어쓸 수 있으므로, **편집기 안에서는 클라이언트에서 본문에 붙이고 기존 저장 경로
(`change`)로 저장**한다. 편집기 `onChange`는 사용자가 입력한 뒤에만(`bodyTouched`) 저장 큐에 넣지만, 아래는
`change({ body })`를 직접 부르므로 이 조건과 무관하게 저장된다. `MarkdownEditor`는 포커스가 없을 때 바뀐
`value`를 `emitUpdate: false`로 반영하므로(대화상자가 열린 동안 편집기는 포커스가 없다) 중복 저장도 없다.

```diff
@@ -11,4 +11,6 @@ (A-2를 함께 적용하면 metadata import 두 줄 위)
 import { Properties, Property } from "@/components/fields/Properties";
+import { LinerMemoDialog, OpenInLiner } from "@/components/liner";
 import { Button, buttonClass, cn, Input } from "@/components/ui";
 import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
+import { appendLinerMemoEntry } from "@/lib/liner";
 import { IMPORTANCE, READ_STATUS, type Importance, type ReadStatus } from "@/lib/enums";
@@ -152,4 +154,13 @@ export function PaperEditor({
           actions={
             <>
+              <OpenInLiner title={title} />
+              <LinerMemoDialog
+                onSubmit={(input) => {
+                  const next = appendLinerMemoEntry(body, input);
+                  setBody(next);
+                  change({ body: next });
+                  return null;
+                }}
+              />
               <ArchivePaperButton paperId={paper.id} archived={Boolean(paper.archivedAt)} />
               <DeletePaperButton paperId={paper.id} title={paper.title} />
```

**스타일 — 결정 필요(디자인).** 보관·삭제는 `QuietButton`(테두리 없음, `text-muted`, `h-7`)이고 라이너 두 버튼은
`buttonClass("secondary", "sm")`(테두리 있음, `text-fg`, `h-7`)라 높이는 같지만 라이너 쪽이 더 눈에 띈다. 선택지:

1. 그대로 둔다 — 라이너 버튼이 이 화면의 주요 2단계 기능이라 보이게 한다.
2. 조용하게 맞춘다 — 2팀 `OpenInLiner`·`LinerMemoDialog`에 `variant`(기본 `"secondary"`) prop을 추가해 상세 헤더에서
   `"ghost"`(`text-muted hover:bg-hover`)로 넘긴다. 1팀 파일 변경 없이 2팀 파일만 바뀐다.

권장은 2(헤더 버튼이 다섯 개로 늘어 테두리 버튼 둘이 저장 버튼과 경쟁함). 결정되면 2팀이 반영한다.
`OpenInLiner`의 복사 안내 문구는 버튼 아래에 떠서 표시되므로 헤더 줄 높이를 바꾸지 않는다. 헤더 오른쪽 묶음은
`flex items-center gap-1`이고 줄바꿈이 없어, 좁은 창(대략 640px 미만)에서는 뒤로 링크와 겹치지 않는지 브라우저 확인이
필요하다(이번에는 확인하지 않음).

편집기가 없는 화면에서는 서버 저장을 쓴다:
`<LinerMemoDialog onSubmit={serverLinerMemoSubmit(paper.id, () => router.refresh())} />`

### B-2. "라이너에서 열기" URL — 확인되지 않은 부분

- 라이너의 제목 검색 URL 형식은 공식 자료로 **확인되지 않았다**(docs/p2/liner-research.md).
  그래서 확인된 경로 `https://liner.com/scholar`를 새 탭(`rel="noopener noreferrer"`)으로 열고, 같은 클릭에서
  논문 제목을 클립보드에 복사한 뒤 "제목을 복사했어요. 라이너 검색창에 붙여넣으세요."를 보여준다.
- 제목은 URL에 넣지 않는다(외부로 전송 없음). 형식이 확인되면 `src/lib/liner/links.ts`의
  `buildLinerSearchUrl`과 `LINER_URL_INCLUDES_TITLE`만 고치면 된다.
- 약관상 라이너 스크래핑·자동화 금지 — 사용자가 붙여넣은 텍스트만 저장한다.

## D. PDF 하이라이트 · 메모 · 목록 패널 · 생각 만들기

새 파일:

- `src/lib/repo/highlights.ts` — `listByPaper(paperId)`, `get(id)`, `create(input)`, `update(id, { note?, color? })`,
  `remove(id)`, `createThought(highlightId)`. `./index.ts`(1팀 파일)에는 넣지 않았으므로
  `import * as highlights from "@/lib/repo/highlights"`로 쓴다.
- `src/lib/highlights/**` — 색상, rects(페이지 대비 0~1 비율) 변환·검증, 읽기 순서 정렬, 생각 제목·본문,
  `?page=&scroll=` 링크 생성·해석(`readerHref`, `parseJumpParams`).
- `src/app/_actions/highlights.ts` — `createHighlight`, `updateHighlight`, `deleteHighlight`,
  `createThoughtFromHighlight`.
- `src/components/highlights/**` — `HighlightReader`(뷰어 + 선택 메뉴 + 오른쪽 목록 패널),
  `PaperHighlights`(논문 상세용 목록), `HighlightPanel`, `PageHighlights`(페이지 오버레이), `SelectionMenu`.
  뷰어 쪽 의존은 D-1의 `renderPageOverlay`·`apiRef`와 `data-pdf-page` 속성뿐이다.

뷰어는 복제하지 않았다. 남은 1팀 파일 변경은 D-2(리더 페이지)와 D-3(논문 상세)뿐이다.

### D-1. `src/components/pdf/PdfViewerClient.tsx` — **1팀이 적용 완료** (develop `42bac67`, `bccec15`에서도 그대로)

1팀이 `renderPageOverlay`, `apiRef`(`PdfViewerApi.goToPage(page, scroll = 0)`), 페이지 상자의
`data-pdf-page`, `PdfViewer.tsx`의 `PdfViewerApi` 재export, 새 `toolbarEnd` 슬롯을 넣었다. 2팀 쪽은 이 실제
타입을 그대로 쓴다(임시 캐스트 제거). `HighlightReader`는 "하이라이트 N" 패널 토글을 `toolbarEnd`에 넣고,
페이지가 넘긴 `toolbarEnd`(예: 집중 모드 토글)는 그 뒤에 그대로 붙인다. 오버레이는 `pointer-events: none` +
`mix-blend-mode: multiply`라 텍스트 선택을 막지 않는다.

### D-2. `src/app/papers/[id]/read/page.tsx` — 하이라이트 리더로 교체 + `?page=` 지원

`?page=N&scroll=0.25`가 있으면 그 위치에서 연다(목록 패널 링크, 검색 팔레트의 `/papers/{id}/read?page=N…`
링크 모두 해당). 없으면 기존처럼 마지막 읽은 위치. `initialReadAt`은 그대로라 원격 위치 확인(`remote-progress`)이
쿼리 위치를 덮어쓰지 않는다(같은 `lastReadAt` → 이동 없음). 기존 `toolbarEnd={<FocusModeToggle />}`와 뒤로 링크의
`in-data-[sidebar=collapsed]:ml-9` 클래스는 **그대로 둔다** — `HighlightReader`는 `toolbarEnd`를 "하이라이트 N"
토글 뒤에 그대로 붙인다. (`integration-impl-12.md`의 2번은 이 D-2로 대체된다.)

```diff
@@ -2,14 +2,19 @@ import type { Metadata } from "next";
 import Link from "next/link";
 import { notFound } from "next/navigation";
-import { PdfViewer } from "@/components/pdf/PdfViewer";
+import { HighlightReader } from "@/components/highlights";
 import { FocusModeToggle } from "@/components/shell/FocusModeToggle";
 import { Page, PageHeader } from "@/components/shell";
+import { parseJumpParams } from "@/lib/highlights";
 import { isValidItemId } from "@/lib/ids";
 import { papers } from "@/lib/repo";
+import * as highlightsRepo from "@/lib/repo/highlights";
 import { PdfDropZone } from "../../_components/PdfUploader";
 
 export const dynamic = "force-dynamic";
 
-type Props = { params: Promise<{ id: string }> };
+type Props = {
+  params: Promise<{ id: string }>;
+  searchParams: Promise<Record<string, string | string[] | undefined>>;
+};
 
 async function load(id: string) {
@@ -22,5 +27,5 @@ export async function generateMetadata({ params }: Props): Promise<Metadata> {
 }
 
-export default async function ReadPaperPage({ params }: Props) {
+export default async function ReadPaperPage({ params, searchParams }: Props) {
   const { id } = await params;
   const paper = await load(id);
@@ -58,13 +63,19 @@ export default async function ReadPaperPage({ params }: Props) {
   // saving the reading position does not.
   const version = encodeURIComponent(paper.updatedAt);
+  // `?page=N[&scroll=0–1]` (highlight list, search palette) overrides the saved position.
+  const jump = parseJumpParams(await searchParams);
+  const highlights = await highlightsRepo.listByPaper(paper.id);
 
   return (
     <div className="flex h-dvh flex-col">
-      <PdfViewer
-        key={paper.updatedAt}
+      <HighlightReader
+        // A new ?page= jump (e.g. from the search palette) remounts at that position.
+        key={`${paper.updatedAt}:${jump?.page ?? ""}:${jump?.scroll ?? ""}`}
+        paperId={paper.id}
+        initialHighlights={highlights}
         file={`/api/papers/${paper.id}/pdf?v=${version}`}
         progressUrl={`/api/papers/${paper.id}/progress`}
-        initialPage={paper.lastPage}
-        initialScroll={paper.lastScroll}
+        initialPage={jump?.page ?? paper.lastPage}
+        initialScroll={jump ? jump.scroll : paper.lastScroll}
         initialReadAt={paper.lastReadAt}
         // Focus mode hides the sidebar (remembered); the reader then fills the width.
```

### D-3. `src/app/papers/[id]/page.tsx` — 논문 상세에 하이라이트 목록

PDF가 있으면 항목을 누르면 리더의 해당 쪽(`?page=&scroll=`)으로 이동한다. 메모 편집·삭제·생각 만들기 가능.

```diff
@@ -1,8 +1,10 @@
 import type { Metadata } from "next";
 import { notFound } from "next/navigation";
+import { PaperHighlights } from "@/components/highlights";
 import { ConnectedItems } from "@/components/links";
 import { Page } from "@/components/shell";
 import { isValidItemId } from "@/lib/ids";
 import { papers, tags } from "@/lib/repo";
+import * as highlightsRepo from "@/lib/repo/highlights";
 import { PaperEditor } from "../_components/PaperEditor";
 import { PdfPanel } from "../_components/PdfPanel";
@@ -23,5 +25,9 @@ export async function generateMetadata({ params }: Props): Promise<Metadata> {
 export default async function PaperPage({ params }: Props) {
   const { id } = await params;
-  const [paper, allTags] = await Promise.all([load(id), tags.listAll()]);
+  const [paper, allTags, paperHighlights] = await Promise.all([
+    load(id),
+    tags.listAll(),
+    highlightsRepo.listByPaper(id), // [] for an invalid id
+  ]);
   if (!paper) notFound();
 
@@ -43,4 +49,9 @@ export default async function PaperPage({ params }: Props) {
         }
       />
+      <PaperHighlights
+        paperId={paper.id}
+        initialHighlights={paperHighlights}
+        hasPdf={Boolean(paper.pdfPath)}
+      />
       <ConnectedItems item={{ type: "paper", id: paper.id }} />
     </Page>
```

### 동작 메모

- 선택 → 떠 있는 메뉴(노랑·초록·파랑·분홍, "메모"): 색을 누르면 바로 저장, "메모"를 열면 메모와 함께 저장.
  메뉴가 열리면 첫 색 버튼에 포커스가 가고, Esc·저장 뒤에는 원래 위치로 포커스가 돌아온다.
  여러 쪽에 걸친 선택은 시작한 쪽 끝에서 잘라 텍스트·위치 모두 그 쪽까지만 저장한다.
  rect는 텍스트 노드에서만 모으고 쪽 대부분을 덮는 rect(Ctrl+A·마지막 줄 너머 드래그)는 버린다.
  스크롤·Esc·바깥 클릭으로 메뉴가 닫힌다.
- rects는 `{x, y, w, h}` 0~1 비율(소수 4자리)로 저장해 확대/축소·창 폭과 무관하다. 같은 줄의 조각은 합친다.
  서버에서 다시 검증한다(최대 500개, 페이지 밖 값 거부). PDF 총 쪽수가 알려져 있으면 그보다 큰 쪽 번호는 거부한다.
- 생각 만들기: 제목 = 하이라이트 앞 80자(넘으면 `…`), 본문 = `> 인용` + `— 논문 제목, p. N` + 메모,
  종류 `memo`·발전 정도 `seed`(홈 빠른 입력과 같은 기본값), 생각 → 논문 링크. 한 트랜잭션.
  만든 뒤 "생각 열기 →" 링크로 이동할 수 있다(자동 이동은 하지 않음).
- 하이라이트 삭제 시 그 하이라이트로 만든 생각은 남는다. 논문 삭제 시 하이라이트는 기존 `papers.remove`가 지운다.
- `highlights` 테이블 스키마는 그대로다(`color`는 문자열 — 팔레트 밖의 기존 값은 노랑으로 표시).
