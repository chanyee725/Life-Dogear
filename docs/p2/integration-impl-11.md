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
