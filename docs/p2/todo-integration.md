# TODO: p2 → develop 통합 (1팀 파일 적용)

> 생성일: 2026-11-02  
> 기준 커밋: `83c4c79` (develop)  
> diff 원본: `docs/p2/integration-impl-11.md`, `docs/p2/integration-impl-12.md`

## 남은 작업 목록

| # | 섹션 | 파일 | 내용 | 필수 |
|---|---|---|---|---|
| 1 | impl-12 | `src/app/layout.tsx` | `<CommandPalette />` 마운트 + `<SearchButton />` 사이드바 삽입 | ✅ 필수 |
| 2 | impl-11 A-1 | `src/app/papers/_components/NewPaperForm.tsx` | DOI/arXiv "링크로 채우기" 폼 삽입 | ✅ 필수 |
| 3 | impl-11 A-2 | `src/app/papers/_components/PaperEditor.tsx` | 상세에도 "링크로 채우기" 추가 | 선택 |
| 4 | impl-11 B-1 | `src/app/papers/_components/PaperEditor.tsx` | 헤더에 `[라이너에서 열기]` `[라이너 메모 붙여넣기]` 버튼 추가 | ✅ 필수 |
| 5 | impl-11 D-2 | `src/app/papers/[id]/read/page.tsx` | 하이라이트 리더로 교체 + `?page=N&scroll=` 지원 | ✅ 필수 |
| 6 | impl-11 D-3 | `src/app/papers/[id]/page.tsx` | 논문 상세에 하이라이트 목록 패널 | ✅ 필수 |

> **D-1 (`PdfViewerClient.tsx`)** 은 1팀 완료 (`42bac67` / `bccec15`) — 건드리지 않음

## 참고

- 각 diff는 확인용 브랜치 `p2/preview-2`(병합 금지)에 실제 적용·검증 완료
- `tsc --noEmit` · `eslint` · `prettier --check` · 관련 단위 테스트 통과 확인 (2026-11-02)
- `Sidebar.tsx` · `SidebarNav.tsx` · `Shortcuts.tsx` · `shortcuts.ts` 는 변경 불필요
- FTS5 도입 검토안은 `docs/p2/search-design.md` "FTS5 마이그레이션 제안" 참고
