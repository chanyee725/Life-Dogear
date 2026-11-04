# 계획: 공용 컴포넌트 통합 리팩토링 (단계 R)

> **승인됨 (2026-11-04)**. 기준 develop `2dcb3d3`. 계기: `/resources`에서 논문 버튼만 스타일이 다름. 새 디자인 도입 금지 — "일관되게 맞추는" 방향만. 우주 보기·그래프 캔버스는 범위 밖. `src/app/loading.tsx` 금지, headless만, push 금지. 사용자가 develop을 직접 고칠 수 있으니 병합 전 항상 develop을 다시 받는다.

## 1. 인벤토리 (R0, 먼저)

`docs/design/components.md`에 표로: 종류 × (흩어진 변형 수, 파일 위치, 스크린샷). 종류:

버튼/링크버튼(primary·secondary·ghost·icon) · 새 항목 버튼 · 탭·세그먼트 · 칩·배지·태그 · 목록 행(논문·노트·세미나·생각·프로젝트) · 상세 헤더(뒤로·보관·삭제·저장) · 섹션 헤더+액션 · 빈 상태/추가(`DashboardAdd` 점선 박스, `TaskList` bare 버튼, 영역 상세 점선 박스 → 공용 `EmptyAdd` 하나) · 입력·검색·셀렉트 · 다이얼로그 · 필터/정렬 바.

- 코드 검색: 구현자 A (`buttonClass`·`<button className=`·`<Link className=` 직접 스타일, 중복 컴포넌트).
- 스크린샷·시각 규칙: 디자이너 (각 종류의 기준 모양 1개 + 변형 props 목록, 라이트/다크).

## 2. 단일 출처 (R1, 구현자 A 먼저 커밋)

`src/components/ui/**`에 공용 컴포넌트를 모은다. 변형은 `variant`/`size` props, 화면별 커스텀 className으로 생긴 시각 차이는 없앤다.
후보: `Button`/`LinkButton`(+`NewItemButton`), `Tabs`/`Segmented`, `Chip`/`Badge`/`TagChip`, `ListRow`, `DetailHeader`, `SectionHeader`, `EmptyAdd`, `Input`/`SearchInput`/`Select`, `Dialog`, `FilterBar`.
첫 적용: `/resources`와 논문 목록의 버튼 불일치.

## 3. 화면 교체 (R2, A의 ui 커밋 위에서 병렬)

| 담당 | 화면·컴포넌트(소유) |
|---|---|
| 구현자 A | `src/components/ui/**`, `src/components/list/**`, `src/app/{papers,notes,seminars,thoughts,resources,tags,archive,inbox}/**` |
| 구현자 B | `src/app/{projects,areas,goals,reviews,tasks}/**`, `src/components/{tasks,fields,links,metadata}/**` |
| 구현자 C | `src/app/page.tsx`, `src/components/{dashboard,calendar,capture,highlights,liner,pdf,editor,search,shell}/**`, `src/components/graph/**`의 캔버스 밖 UI(필터 바·패널) |

- 동작·접근성·e2e 셀렉터 유지. 바뀌면 테스트도 같이.
- B·C는 A의 R1 커밋 전에는 자기 영역 조사만, 코드는 그 위에서. 공용 ui 변경이 더 필요하면 A에게 요청(직접 수정 금지).

## 4. 보고

Before/After headless 스크린샷 몇 장, 종류별 변형 수(전→후), 지운 중복 컴포넌트·className 수.

| 역할 | 범위 |
|---|---|
| 디자이너 | 1의 시각 인벤토리·기준 규칙(`components.md`), 끝나고 After 스크린샷 검토 |
| 리뷰어 | 전체. 시각 회귀(의도 외 변화), 접근성, e2e 셀렉터, 중복이 실제로 줄었는지 |
