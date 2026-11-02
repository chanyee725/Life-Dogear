# p2 → develop 통합 (1팀 파일 적용) — 완료

> 생성일: 2026-11-02 · 갱신: 2026-11-03
> 상태: **6개 항목 모두 develop `83c4c79`에 적용 완료**
> diff 원본: `docs/p2/integration-impl-11.md`, `docs/p2/integration-impl-12.md`

## 적용 현황

| # | 섹션 | 파일 | 내용 | 상태 | 적용 커밋 |
|---|---|---|---|---|---|
| 1 | impl-12 | `src/app/layout.tsx` | `<CommandPalette />` 마운트 + `<Sidebar searchSlot={<SearchButton />} />` | ✅ 완료 | `83c4c79` |
| 2 | impl-11 A-1 | `src/app/papers/_components/NewPaperForm.tsx` | DOI/arXiv "링크로 채우기" 폼 | ✅ 완료 | `83c4c79` |
| 3 | impl-11 A-2 | `src/app/papers/_components/PaperEditor.tsx` | 상세에도 "링크로 채우기" | ✅ 완료 | `83c4c79` |
| 4 | impl-11 B-1 | `src/app/papers/_components/PaperEditor.tsx` | 헤더 `[라이너에서 열기]` `[라이너 메모 붙여넣기]` (보관 버튼 앞) | ✅ 완료 | `83c4c79` |
| 5 | impl-11 D-2 | `src/app/papers/[id]/read/page.tsx` | 하이라이트 리더로 교체 + `?page=N&scroll=` | ✅ 완료 | `83c4c79` |
| 6 | impl-11 D-3 | `src/app/papers/[id]/page.tsx` | 논문 상세 하이라이트 목록 | ✅ 완료 | `83c4c79` |

- D-1(`PdfViewerClient.tsx`)은 1팀이 먼저 적용(`42bac67`, `bccec15`에서도 그대로).
- 확인: `83c4c79`의 `src/app`은 확인용 브랜치 `p2/preview-2`(`58ee878`, 병합 금지)와 차이가 없다. 그 브랜치에서
  `tsc --noEmit`·`eslint`·`prettier --check`·관련 단위 테스트를 통과했다(2026-11-02).
- `Sidebar.tsx`·`SidebarNav.tsx`·`Shortcuts.tsx`·`shortcuts.ts`는 바꾸지 않았다.

## 남은 결정 사항

| 항목 | 내용 | 담당 |
|---|---|---|
| 라이너 버튼 스타일 | 상세 헤더에서 라이너 두 버튼은 테두리 버튼(`secondary`), 보관·삭제는 조용한 `QuietButton`. 그대로 둘지, 2팀 컴포넌트에 `variant` prop을 추가해 `ghost`로 맞출지(1팀 파일 변경 없음). `integration-impl-11.md` B-1 참고 | 사용자 결정 |
| 좁은 창 헤더 넘침 | 헤더 오른쪽이 버튼 5개 + 저장 상태(`flex`, 줄바꿈 없음). 약 1024px·768px에서 뒤로 링크와 겹치거나 넘치는지 브라우저 확인 | 브라우저 스모크 |
| `.playwright-mcp/` gitignore | Playwright MCP가 프로젝트 루트에 만드는 폴더. 이전 `p2/preview`에서는 `.gitignore`에 넣었지만 develop `.gitignore`에는 없다(1팀 파일) | 1팀 판단 |

## 참고

- FTS5 도입 검토안: `docs/p2/search-design.md` "FTS5 마이그레이션 제안"(적용하지 않음, 도입 시 `0002+`).
