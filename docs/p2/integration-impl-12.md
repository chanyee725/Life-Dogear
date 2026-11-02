# 1팀 파일 통합 요청 — impl-12 (작업 C: 전체 검색 / Cmd+K)

> 2팀은 1팀 소유 파일을 고치지 않았다. 아래 변경을 develop-p2 → develop 통합 시점에 1팀(또는 관리자)이 적용해 주세요.
> 담당: impl-15(impl-11·12 인계). **기준 코드: 1팀 develop `bccec15`**(1.5단계 — `Sidebar`의 `searchSlot`,
> `SidebarNav`, `connection()` 요청 시점 렌더)가 병합된 develop-p2 `b7ac924`.
> 아래 diff는 확인용 브랜치 `p2/preview-2`(병합 금지)에 실제로 적용한 것을 그대로 옮겼고, `tsc --noEmit`·`eslint`·
> `prettier --check`와 단일 테스트 `shell-shortcuts`·`search-palette`·`papers-actions` 통과를 확인했다(2026-11-02).

## 요약

| # | 파일 | 필수 여부 | 내용 |
|---|---|---|---|
| 1 | `src/app/layout.tsx` | **필수** | `<CommandPalette />` 마운트 — 이게 없으면 Cmd/Ctrl+K가 동작하지 않음 |
| 2 | `src/app/layout.tsx` (같은 diff) | 선택(디자인 판단) | 사이드바 "검색 ⌘K" 버튼: 1팀이 만든 `Sidebar`의 `searchSlot` prop에 `<SearchButton />`을 넘긴다 |
| — | `src/app/papers/[id]/read/page.tsx` | **impl-11 D-2로 대체** | `?page=N&scroll=…` 지원은 `docs/p2/integration-impl-11.md` D-2가 정본 |

**1팀 shell 파일(`Sidebar.tsx`·`SidebarNav.tsx`·`Shortcuts.tsx`·`shortcuts.ts`)은 바꿀 필요 없다.**

- `Sidebar`(서버 컴포넌트)는 `searchSlot`을 그대로 `SidebarNav`(클라이언트)에 넘기고, `SidebarNav`가 앱 이름 줄 아래·
  `<nav>` 위에 `<div className="px-3 pb-2">{searchSlot}</div>`로 감싸 그린다. 그래서 `SearchButton`에는 바깥 여백
  `div`를 두지 않는다(이전 문서의 `px-3 pb-2` 래퍼는 이제 `SidebarNav` 쪽에 있음).
- `SearchButton`은 `"use client"` 컴포넌트다. 서버 컴포넌트(`layout` → `Sidebar`)가 클라이언트 컴포넌트 **요소**를
  prop으로 넘기는 것은 RSC가 허용하는 형태이고, `Sidebar`의 `await connection()`(요청 시점 렌더)·DB 오류 시 빈
  사이드바 처리와도 무관하다 — 버튼은 DB 데이터를 읽지 않는다.
- 사이드바가 접힌 상태(`data-sidebar=collapsed`, `<aside>` 숨김)에서는 버튼도 함께 숨지만, 팔레트가 Cmd/Ctrl+K를
  직접 듣기 때문에 단축키는 그대로 동작한다. 기존 `resolveShortcut`은 수식키가 눌리면 무시하므로 충돌하지 않는다.
- 다른 곳에서 팔레트를 열고 싶으면 `window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))`(`@/components/search`).

## 1·2. `src/app/layout.tsx`

```diff
@@ -1,4 +1,6 @@
 import type { Metadata } from "next";
 import localFont from "next/font/local";
+import { CommandPalette } from "@/components/search/CommandPalette";
+import { SearchButton } from "@/components/search/SearchButton";
 import { Shortcuts } from "@/components/shell/Shortcuts";
 import { Sidebar } from "@/components/shell/Sidebar";
@@ -33,7 +35,8 @@ export default function RootLayout({ children }: Readonly<{ children: React.Reac
       </head>
       <body className="flex min-h-dvh">
-        <Sidebar />
+        <Sidebar searchSlot={<SearchButton />} />
         <main className="min-w-0 flex-1">{children}</main>
         <Shortcuts />
+        <CommandPalette />
       </body>
     </html>
```

검색 버튼을 넣지 않기로 하면 `SearchButton` import와 `searchSlot={…}`만 빼고 `<Sidebar />`로 둔다(`searchSlot`이
없으면 `SidebarNav`가 자리를 그리지 않음). 버튼 대신 사이드바 아래 단축키 안내(`SidebarNav`의 `N 새 항목`·
`/ 빠른 입력`)에 `⌘K 검색` 한 줄을 넣는 방법도 있지만 그건 1팀 `SidebarNav.tsx` 변경이라 이 문서에는 넣지 않았다.

## `src/app/papers/[id]/read/page.tsx` — D-2로 대체됨

**이 문서에서는 적용하지 말 것.** 리더 페이지의 `?page=` 지원은 `docs/p2/integration-impl-11.md` **D-2**
(하이라이트 리더 교체 + `parseJumpParams`)가 정본이다. 검색 팔레트의 하이라이트 링크는
`readerHref(paperId, page, scrollTargetFor(rects))`(`src/lib/highlights`)로 만들어 D-2가 읽는 `?page=N&scroll=S`
형식과 같다. D-2가 적용되면 검색 결과에서 하이라이트 위치로 바로 이동한다.

## 검색 대상 (1.5 반영)

프로젝트·**영역**·논문·세미나·생각·하이라이트. 보관된 항목도 결과에 나오고 회색 "보관됨" 배지가 붙는다
(하이라이트는 소속 논문이 보관이면). 자세한 내용은 `docs/p2/search-design.md` "영역(area)과 보관".

## 스키마·마이그레이션

필요 없음. LIKE 검색이라 `schema.ts`·`drizzle/`을 바꾸지 않는다. FTS5 도입안은 `docs/p2/search-design.md`의
"FTS5 마이그레이션 제안"(적용하지 않음, 도입 시 `0002+`)을 보라.
