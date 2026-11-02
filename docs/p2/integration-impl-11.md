# impl-11 — 1팀 파일에 필요한 변경 (2단계 통합용)

2팀(impl-11)이 새 파일로 만든 기능을 1단계 화면에 붙이려면 아래 기존 파일 변경이 필요하다.
모두 1팀 소유 파일이라 직접 고치지 않았다. 스키마·package.json 변경은 없다.

## A. DOI/arXiv "링크로 채우기"

새 파일: `src/lib/metadata/**`, `src/app/_actions/metadata.ts`(서버 액션 `lookupPaperMetadata`),
`src/components/metadata/FillFromLink.tsx`, `src/components/metadata/apply.ts`.

### A-1. `src/app/papers/_components/NewPaperForm.tsx` — 새 논문 폼 맨 위에 끼우기

입력란은 비제어(uncontrolled)이므로 `applyMetadataToForm`으로 `name`별 값을 넣고,
`AuthorsField`는 내부 상태를 가지므로 `key`를 바꿔 새 목록으로 다시 마운트한다.
가져온 값은 해당 필드를 **덮어쓴다**(사용자가 버튼을 눌러 요청한 동작).

```diff
-import { startTransition, useActionState } from "react";
+import { startTransition, useActionState, useRef, useState } from "react";
+import { FillFromLink } from "@/components/metadata/FillFromLink";
+import { applyMetadataToForm } from "@/components/metadata/apply";
@@ export function NewPaperForm({ tagSuggestions }: { tagSuggestions: string[] }) {
+  const formRef = useRef<HTMLFormElement>(null);
+  const [authors, setAuthors] = useState<{ version: number; list: string[] }>({ version: 0, list: [] });
@@
     <form
+      ref={formRef}
       onSubmit={(event) => {
@@
-      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
+      <FillFromLink
+        onFill={(meta) => {
+          if (formRef.current) applyMetadataToForm(formRef.current, meta);
+          if (meta.authors.length) {
+            setAuthors((prev) => ({ version: prev.version + 1, list: meta.authors }));
+          }
+        }}
+      />
+      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
@@
         <Field label="저자" htmlFor="paper-authors" className="sm:col-span-2">
-          <AuthorsField id="paper-authors" name="authors" />
+          <AuthorsField
+            key={authors.version}
+            id="paper-authors"
+            name="authors"
+            defaultValue={authors.list}
+          />
         </Field>
```

### A-2. `src/app/papers/_components/PaperEditor.tsx` — 논문 상세(선택)

상세 화면은 자동 저장 큐가 있으므로 `change()`로 넣으면 그대로 저장된다.
비제어 입력(연도·학술지·DOI·링크·저자)은 `fillVersion` 키로 다시 마운트해 새 값을 보여준다.

```diff
+import { FillFromLink } from "@/components/metadata/FillFromLink";
+import { metadataToFields } from "@/components/metadata/apply";
@@
+  const [fillVersion, setFillVersion] = useState(0);
+  const [filled, setFilled] = useState<Partial<PatchInput>>({});
+  const current = { ...paper, year: paper.year?.toString() ?? "", ...filled };
@@ (제목 입력 아래, 필드 그리드 위)
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
@@ 그리드의 AuthorsField / 연도·학술지·DOI·링크 TextField
-          <AuthorsField id="paper-authors" defaultValue={paper.authors}
+          <AuthorsField key={`a${fillVersion}`} id="paper-authors" defaultValue={current.authors}
-        <TextField id="paper-year" ... defaultValue={paper.year?.toString() ?? ""}
+        <TextField key={`y${fillVersion}`} id="paper-year" ... defaultValue={current.year}
         (venue / doi / url 도 같은 방식: key={`v${fillVersion}`} 등, defaultValue={current.venue} …)
```

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

출처: [라이너](https://liner.com/…)   ← 출처 링크가 없으면 "출처: 라이너 스콜라"
```

### B-1. `src/app/papers/_components/PaperEditor.tsx` — 상단 버튼 줄에 두 버튼 추가

상세 화면은 본문을 편집기 상태(`body`)와 자동 저장 큐로 들고 있다. 서버에서 본문을 바꾸면 대기 중인
본문 저장이 그것을 덮어쓸 수 있으므로, **편집기 안에서는 클라이언트에서 본문에 붙이고 기존 저장 경로
(`change`)로 저장**한다. (`MarkdownEditor`는 포커스가 없을 때 바뀐 `value`를 반영한다 — 대화상자가 열려 있는
동안 편집기는 포커스가 없다.)

```diff
+import { LinerMemoDialog, OpenInLiner } from "@/components/liner";
+import { appendLinerMemoEntry } from "@/lib/liner";
@@ 상단 오른쪽 버튼 묶음 (<div className="flex items-center gap-2"> … 저장 버튼 앞)
+            <OpenInLiner title={title} />
+            <LinerMemoDialog
+              onSubmit={(input) => {
+                const next = appendLinerMemoEntry(body, input);
+                setBody(next);
+                change({ body: next });
+                return null;
+              }}
+            />
             <Button variant="secondary" size="sm" onClick={saveNow}>
```

`OpenInLiner`는 안내 문구가 버튼 아래에 붙으므로, 버튼 줄 배치가 어색하면 제목 아래 별도 줄
(`<div className="flex items-center gap-2">`)에 두 버튼을 두는 것도 괜찮다.

편집기가 없는 화면(예: 2단계 하이라이트 패널)에서는 서버 저장을 쓴다:
`<LinerMemoDialog onSubmit={serverLinerMemoSubmit(paper.id, () => router.refresh())} />`

### B-2. "라이너에서 열기" URL — 확인되지 않은 부분

- 라이너의 제목 검색 URL 형식은 공식 자료로 **확인되지 않았다**(docs/p2/liner-research.md).
  그래서 확인된 경로 `https://liner.com/scholar`를 새 탭(`rel="noopener noreferrer"`)으로 열고, 같은 클릭에서
  논문 제목을 클립보드에 복사한 뒤 "제목을 복사했어요. 라이너 검색창에 붙여넣으세요."를 보여준다.
- 제목은 URL에 넣지 않는다(외부로 전송 없음). 형식이 확인되면 `src/lib/liner/links.ts`의
  `buildLinerSearchUrl`과 `LINER_URL_INCLUDES_TITLE`만 고치면 된다.
- 약관상 라이너 스크래핑·자동화 금지 — 사용자가 붙여넣은 텍스트만 저장한다.
