# 계획: 할 일 + 오늘 화면 + 빠른 캡처 (단계 T)

> **승인됨 (2026-11-03)**: 사용자 요청 그대로. 만들지 않는 것: 로그인, 반복 습관·루틴.
> 디자인은 기존 조용한 규칙(`docs/SPEC.md` 디자인 가이드, `docs/design/graph.md`)을 따른다. `src/app/loading.tsx`는 다시 넣지 않는다.

## 1. 스키마 (마이그레이션 `0004`, CREATE TABLE만)

새 `tasks`

| 열 | 타입 | 비고 |
|---|---|---|
| `id` | text pk | |
| `title` | text not null | 1~300자 |
| `done_at` | text null | 완료 시각(null = 미완료) |
| `due_date` | text null | `YYYY-MM-DD` |
| `parent_type` | text null | `project` / `goal` / `area` / null(소속 없음 = 할 일 수집함) |
| `parent_id` | text null | 부모 id(FK 없음 → 부모 삭제 시 repo에서 정리) |
| `sort_order` | integer not null | 같은 부모 안 순서 |
| `archived_at` | text null | 부모가 보관되면 함께 숨김(계산), 개별 보관은 하지 않음 |
| `created_at`, `updated_at` | text | |

- 인덱스: `(parent_type, parent_id, sort_order)`, `(done_at, due_date)`.
- 할 일은 `ITEM_TYPE`에 넣지 않는다(상세 화면이 없음, 링크·태그 대상 아님). 그래프 노드 종류에는 `task`를 따로 추가한다.
- 부모 항목 삭제 시: `links.removeLinksFor` 안에서 그 부모의 할 일도 지운다(이미 모든 삭제가 거침).
- 루트 DB에는 적용하지 않는다. 병합 후 "루트 DB `npm run db:migrate` 필요"로 보고.

## 2. 진행률 규칙 (기존과 어긋나지 않게)

- 프로젝트: 상태·단계는 그대로. 상세에 "할 일 n/m"만 보조로 표시(완료로 자동 전환하지 않음).
- 분기 목표 auto: **연결된 프로젝트가 있으면 지금처럼 프로젝트 완료 비율.** 프로젝트가 없고 목표에 직접 붙은 할 일이 있으면 그 완료 비율. 둘 다 없으면 수동 값. 연 목표·인생 목표 규칙은 그대로.
- 영역: 진행률 없음. "할 일 n/m"만.

## 3. 화면

| 경로 | 내용 |
|---|---|
| 프로젝트·목표·영역 상세 | "할 일" 섹션: 추가(Enter), 완료 체크, 마감일, 순서 바꾸기(↑↓·키보드), 삭제, 완료 항목 접기 |
| `/tasks` (사이드바 "할 일") | 탭: 오늘 / 이번 주 / 마감 지남 / 소속별(프로젝트·목표·영역·소속 없음). 각 줄에 소속 링크 |
| 홈 `/` = 오늘 화면 | 오늘·마감 지난 할 일, 이번 주 마감, 수집함 n개(정리 유도), 오래 손 안 댄 중요한 별(우주 보기 점수 재사용), 진행 중 분기 목표(진행률). 기존 빠른 입력·이어 읽기는 유지 |
| 주간 회고 | 새 주간 회고 초안에 이번 주 만든 항목 / 완료한 할 일 / 끝난 프로젝트를 자동으로 모아 넣음(작성 시점 1회, 사용자가 고칠 수 있음) |
| Cmd+K | 할 일 검색(결과는 소속 화면으로, 소속 없으면 `/tasks`) |
| 그래프 | 노드 종류 `task`, **기본 꺼짐**(필터에서 켬), 부모에 소속 선. 우주 보기에서는 표시하지 않음 |
| 빠른 캡처(③, 1·2 병합 뒤) | 어디서든 단축키(예: `Shift+N` — 디자이너가 확정)로 작은 창 → 생각 또는 링크를 수집함에 저장 |

## 4. 작업 분할

| 담당 | 범위(소유 파일) |
|---|---|
| 구현자 A | `src/db/**`, `drizzle/0004_*`, `src/lib/repo/tasks.ts`(+ `links.ts` 정리 1줄, `goals.ts` 진행률 규칙), `src/app/_actions/tasks.ts`, `src/components/tasks/**`(할 일 목록 컴포넌트), `src/app/tasks/**`, 프로젝트·목표·영역 상세에 할 일 섹션 1줄씩, 사이드바 "할 일" 메뉴(`src/components/shell/nav.ts`·`SidebarNav`), `src/lib/search/**` 할 일 소스 |
| 구현자 B | 홈 오늘 화면(`src/app/page.tsx`, `src/components/dashboard/**`), 주간 회고 초안 자동 모음(`src/lib/reviews/**`, `src/lib/repo/reviews.ts`), 그래프 `task` 노드(`src/lib/graph/**`, `src/components/graph/**` 필터), 이후 ③ 빠른 캡처 |
| 디자이너 | `docs/design/today.md`(할 일 목록·`/tasks`·오늘 화면·빠른 캡처의 조용한 규칙과 문구), 화면 검토 |
| 리뷰어 | 전체 리뷰 |

### 인터페이스 (B가 A를 기다리지 않게)

```ts
// @/lib/repo — tasks
type TaskParent = { type: "project" | "goal" | "area"; id: string } | null
tasks.list(opts?: { parent?: TaskParent; done?: boolean; dueBefore?: string; dueFrom?: string; includeArchivedParents?: boolean }): Promise<Task[]>
tasks.listToday(today: string): Promise<{ today: Task[]; overdue: Task[] }>
tasks.listThisWeek(from: string, to: string): Promise<Task[]>
tasks.listCompletedBetween(from: string, to: string): Promise<Task[]>   // 회고 초안용
tasks.countFor(parents: TaskParent[]): Promise<Record<string, { done: number; total: number }>>  // "type:id" 키
// Task = { id, title, doneAt, dueDate, parentType, parentId, parentTitle?, sortOrder, createdAt, updatedAt }
```

## 5. 순서

1. A: 스키마·repo·인터페이스 커밋(선행) → B·C는 그 위에서.
2. A: 할 일 화면들 / B: 오늘 화면·회고 초안·그래프 노드 / 디자이너: `today.md` — 동시에.
3. 리뷰 → 병합 → 점검.
4. B: 빠른 캡처 → 리뷰 → 병합 → 전체 점검(lint·타입·단위·빌드·e2e) → 보고.
