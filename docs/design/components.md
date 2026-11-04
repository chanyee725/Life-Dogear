# 공용 컴포넌트 (단계 R)

기준 develop `94e8a0a`. 공용 컴포넌트는 `src/components/ui/**` 한 곳에만 둔다.
새 디자인은 넣지 않는다. 종류마다 **가장 많이 쓰던 기존 모양**을 기준으로 삼고 나머지를 거기에 맞춘다.
우주 보기(`CosmosPanel`·3D)와 그래프 캔버스는 범위 밖이다.

## 1. 코드 인벤토리 (R0, 교체 전)

검색: `buttonClass(` 사용, 직접 스타일한 `<button className=`·`<Link className=`, 화면마다 따로 만든 빈 상태·탭·칩·행·헤더.
"변형 수"는 눈에 다르게 보이는 class 조합의 수다.

| 종류 | 변형 수 | 위치 (대표) | 비고 |
|---|---|---|---|
| 버튼 `buttonClass`/`<Button>` | 6 (primary·secondary·ghost × sm·md) + 직접 스타일 9 | `buttonClass` 46곳, `<Button>` 55곳. 직접: `QuietButton`(fields/ItemDetail), `RecommendedAreas`, `SignOutButton`, `GraphPreview` 행, `CalendarView` 텍스트 버튼 3종, `TaskList` 행 버튼, `PdfViewerClient` 툴바 | 링크 버튼은 매번 `<Link className={buttonClass(..)}>`를 손으로 씀 |
| 새 항목 버튼 | 4 | 헤더 primary md: notes·seminars·thoughts·projects·areas·goals / **papers만 primary md + `<Kbd>N</Kbd>`** / inbox secondary md / 빈 상태 primary sm 6곳 | `/resources`·논문 목록 불일치의 원인 |
| 탭 (밑줄) | 1 | `list/Tabs.tsx` `LinkTabs` — goals·projects·tasks·reviews | 위치만 `list/` |
| 세그먼트 | 4 | `list/ViewToggle`(h-7 w-8 아이콘), `shell/ThemeToggle`(h-6 아이콘), `calendar/Segmented` `SegmentedLinks`(h-6 링크), `graph/GraphFilterBar` `ColorByToggle`(border·bg-surface, 방향키) | 모두 `bg-subtle p-0.5` 트랙 + `bg-bg shadow-sm` 선택. ColorByToggle만 테두리 트랙 |
| 필터 칩 | 2 | `list/TagFilter` `filterChipClass` (papers·notes·seminars·thoughts·projects·tags·resources·goals), `TopicPicker` 트리거(같은 칩 + `border-border`) | |
| 배지·태그 | 2 | `ui/Badge` `Badge`·`TagChip`, `list/TagList` | 이미 단일 출처 |
| 목록 행 | 4 | `ul.divide-y.rounded-lg.border` 8곳: resources·archive·tags/[name]·ConnectedItems `li` = `px-3 py-2 gap-2.5`(4), archive `gap-3`, tags/[name] `py-2.5`, AreasView `gap-1`·`py-1.5 pl-3 pr-2`, inbox `px-4 py-3` | |
| 상세 헤더 | 1 (+버튼 1) | `fields/ItemDetail` `DetailHeader`·`QuietButton` — PaperEditor·ItemForm | 위치만 `fields/` |
| 섹션 헤더 | 3 | `ui/Card` `Section`(9곳), `dashboard/DashboardSection`(6곳, `aria-labelledby` 있음), 손으로 쓴 `h2.text-[13px].font-semibold.text-muted` 5곳(tasks 3·TopicIndex·PaperHighlights·TodayPanel) | 두 컴포넌트가 같은 모양 |
| 빈 상태/추가 | 3 | `dashboard/DashboardAdd`(점선 박스 + ghost sm 링크, 6곳: 홈 4·영역 상세 2), `tasks/TaskList` `AddLine bare`(버튼 자체가 점선, `py-5 text-sm`), `ui/EmptyState`(점선 + 문구, 목록 18곳) | 앞의 둘 → `EmptyAdd` |
| 입력·검색·셀렉트 | 5 | `ui/Input` `Input`·`Select`(h-9), `controlClass` 직접 6곳, 작은 검색 `h-8 text-[13px]`(TopicIndex·AreasView), `h-7 text-[13px]`(GoalList), TopicPicker 자체 class, `GraphFilterBar` 생 `<select>` | |
| 다이얼로그 | 1 (+오버레이 3) | `ui/Dialog`·`ConfirmDialog` 8곳. 따로: CommandPalette·QuickCapture·SidebarNav 모바일 서랍 | 오버레이 3개는 다이얼로그가 아닌 팔레트·서랍이라 유지 |
| 필터/정렬 바 | 2 | `list/ViewToggle` `ListView` 툴바 줄, `GraphFilterBar` | |

## 2. 기준 모양 (R1)

| 종류 | 기준 | 공용 컴포넌트 |
|---|---|---|
| 버튼 | `rounded-lg font-medium`; md `h-9 px-3.5 text-sm`, sm `h-7 px-2.5 text-[13px]`, icon `h-8 w-8` | `Button`, `LinkButton`, `buttonClass` |
| 새 항목 | 헤더: primary md, `aria-keyshortcuts="N"`, Kbd 없음. 빈 상태 안: primary sm | `NewItemButton` |
| 조용한 버튼 | `h-7 px-2 text-[13px] text-muted`, hover `bg-hover` | `QuietButton` |
| 탭 | 밑줄 `h-9 border-b-2`, 선택 `border-fg font-medium` | `LinkTabs` |
| 세그먼트 | 트랙 `rounded-lg bg-subtle p-0.5`, 칸 `h-6 rounded-md px-2.5 text-[13px]`, 선택 `bg-bg text-fg shadow-sm`; 방향키 이동 | `Segmented`, `SegmentedLinks` |
| 칩 | `h-7 rounded-lg border px-2.5 text-[13px]`, 선택 `border-accent/30 bg-accent-soft text-accent font-medium` | `chipClass`, `Chip` |
| 배지·태그 | `h-5 rounded-md px-1.5 text-xs` | `Badge`, `TagChip` |
| 목록 행 | 틀 `divide-y rounded-lg border`, 행 `flex items-center gap-2.5 px-3 py-2` | `RowList`, `ListRow` |
| 상세 헤더 | `← 뒤로`(13px muted) · 저장 상태 · 조용한 버튼들 | `DetailHeader` |
| 섹션 헤더 | `h2 text-[13px] font-semibold text-muted` + 오른쪽 액션, `id`가 있으면 `aria-labelledby` | `Section`, `SectionHeader` |
| 빈 추가 | 점선 박스 `rounded-lg border-dashed px-4 py-5` 가운데 ghost sm 버튼(`＋ …`) — 2dcb3d3 모양 | `EmptyAdd` |
| 빈 상태 | 점선 박스 `py-12` + 제목 + 액션 | `EmptyState` |
| 입력 | md `h-9 text-sm`, sm `h-8 text-[13px]` | `Input`, `SearchInput`, `Select`, `Textarea` |
| 다이얼로그 | 네이티브 `<dialog>`, `rounded-lg shadow-overlay`, 폭 28rem | `Dialog`, `ConfirmDialog` |
| 필터 바 | 왼쪽 필터들(wrap) · 오른쪽 끝 고정 요소, `items-start gap-3` | `FilterBar` |
