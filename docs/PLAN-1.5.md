# Research Brain — 1.5단계 계획 (PARA 뼈대)

> 근거: `docs/PROPOSAL-SECOND-BRAIN.md`와 2026-11-02 사용자 결정(Q1~Q11). 이 문서를 사용자가 승인하기 전에는 구현하지 않는다.
> 범위: PARA 뼈대만. **목표(goals)·주간 검토(reviews)·디스코드 알림은 2단계와 함께** 하며 이번에 만들지 않는다. 디스코드 알림은 설계안을 먼저 사용자에게 보고한다(디자이너 #9 작성 중).
> 미결정 S1(상세 화면 통일)·S8(읽기 집중 모드)·tailwind-merge는 이번 범위에 넣지 않는다.

## 1. 범위

| # | 기능 | 결정 근거 |
|---|---|---|
| 1 | 프로젝트 2종류: `kind` = 연구(research) / 일반(general). 연구는 기존 8단계, 일반은 상태(진행 중·보류·완료)만 | Q1 |
| 2 | 사이드바 "연구" → "프로젝트", `/projects` 안에 [연구 \| 그 외] 탭. URL은 `/projects` 유지 | Q2 |
| 3 | 프로젝트 "다음 할 일" 한 줄 필드(목록·홈·상세에 표시). 할 일 목록 기능은 없음 | Q7 |
| 4 | 영역(Area): 목록 `/areas`, 상세 `/areas/[id]`(소속 프로젝트·연결 항목), 새로 만들기, 정렬 순서. 영역이 0개면 사이드바에 "추천 영역 4개(연구 분야·학위·건강·커리어)" 체크 후 생성 — 자동 생성 없음 | Q3 |
| 5 | 프로젝트 → 영역 소속(`area_id`, 하나). 다른 항목과 영역은 기존 다대다 연결로 | 제안서 6.1 |
| 6 | 보관(`archived_at`): 4타입·영역에 "보관/보관 해제". 목록·홈·검색 제목 피커에서 기본 제외, `/archive` 보관함에서 보기·해제 | Q9(보관 시점은 사용자가 직접; 주간 검토 연동은 2단계) |
| 7 | 수집함 `/inbox`: 연결 0개·태그 0개·보관 안 된 생각. 사이드바에 개수(0이면 숨김). 항목마다 태그 달기·연결·보관 빠른 동작 | Q8 |
| 8 | "태그" → "주제"(사이드바·화면 문구만, URL `/tags` 유지) | Q4 |
| 9 | 홈: "진행 중인 연구" 칸반 → "진행 중인 프로젝트"([연구 칸반 \| 그 외 목록] 탭, 다음 할 일 표시), 수집함 개수 한 줄 | 제안서 5.1 |
| 10 | 연구 단계 `submitted` ↔ 상태 `done` 동기화(repo), 완료 시각 `completed_at` | 제안서 6.1 |
| 11 | seed 갱신: 가짜 영역 4, 일반 프로젝트 1, 보관된 항목 1, 수집함 생각 2 | 제안서 6.3 |

## 2. 데이터 모델 (마이그레이션 `0001`, 비파괴)

- `projects` + `kind text default 'research'`, `status text default 'active'`(active/on_hold/done), `area_id text null → areas.id on delete set null`, `next_action text default ''`, `completed_at text null`
- `projects`·`papers`·`seminars`·`thoughts` + `archived_at text null`
- 새 `areas`: `id, title, standard, sort_order int, body, archived_at, created_at, updated_at`
- 백필: `stage='submitted'` → `status='done'`, `completed_at=updated_at`
- 인덱스: `projects(kind, status, archived_at)`, `projects(area_id)`, 각 타입 `(archived_at)`
- `ITEM_TYPE`에 `area` 추가(`links`·`item_tags`는 CHECK 제약이 없어 SQL 변경 없음)
- `goal_id`, `goals`, `reviews`는 2단계 마이그레이션에서 추가
- drizzle-kit이 테이블 재작성을 만들면 `ADD COLUMN`으로 손질하고 리뷰. 기존 데이터 손실 없음을 마이그레이션 테스트로 확인(0000 상태 DB에 샘플 → 0001 적용 → 값 보존)

## 3. 화면

| 경로 | 변경 |
|---|---|
| 사이드바 | 홈 · 수집함(n) / 프로젝트 / 영역(목록, +) / 논문 · 세미나 · 생각 · 주제 / 보관함. 구역 제목은 작은 글씨. 목표·주간 검토 자리는 2단계 |
| `/projects` | [연구 \| 그 외] 탭(`?kind=`), 일반은 상태 필터, 열에 다음 할 일·영역 |
| `/projects/new`, `/projects/[id]` | 종류 선택(새로 만들 때), 영역 선택, 다음 할 일, 일반은 상태, 보관 버튼 |
| `/areas`, `/areas/new`, `/areas/[id]` | 영역 목록(정렬), 상세(유지 기준·본문·소속 프로젝트·연결된 항목), 보관 |
| `/inbox` | 수집함 목록 + 빠른 동작 |
| `/archive` | 타입별 보관 항목, 보관 해제 |
| `/papers`·`/seminars`·`/thoughts` 상세 | 보관 버튼(목록에선 기본 제외) |
| `/tags` | 화면 문구 "주제" |
| 홈 | 진행 중인 프로젝트 탭, 수집함 한 줄 |

## 4. 역할 분담 (파일 소유, 2팀과 겹치지 않게)

| 순서 | 담당 | 범위 |
|---|---|---|
| A | 구현자 #2 | `src/db/schema.ts`, `drizzle/0001_*`, `src/lib/repo/**`(areas·archive·inbox·projects 확장·items TABLES), `src/lib/enums.ts`, `scripts/seed.ts`, `src/app/_actions/**`(archive·area 액션), `src/components/links/**`(area 타입), `src/app/tags/**`(문구) + 마이그레이션 테스트 |
| B (A 병합 후) | 구현자 #3 | `src/components/shell/**`(사이드바 IA·수집함 개수), `src/app/{projects,areas,inbox,archive}/**`, `src/components/fields/**`(영역 선택·종류·상태 필드) |
| B (A 병합 후) | 구현자 #4 | `src/app/page.tsx`, `src/components/dashboard/**`(진행 중인 프로젝트 탭·수집함 줄), `src/app/{papers,seminars,thoughts}/**` 보관 버튼 연결 |
| 리뷰 | 리뷰어 #5 | A 전부, B 교차 |
| 테스트 | 테스터 #7 | e2e: 영역 생성(추천 4개), 프로젝트 종류·탭·다음 할 일, 보관→보관함→해제, 수집함 |
| 디자인 | 디자이너 #9 | 디스코드 설계 문서 → 화면 병합 후 가이드 검토 |
| 문서 | 문서화 #8 | README 1.5 체크리스트 |

**2팀(관리자 #10) 조율 결과**
- 마이그레이션: 2팀은 `schema.ts`·`drizzle/**`를 바꾸지 않는다. 1팀 `0001`을 먼저 develop에 넣고, FTS 등 2팀 마이그레이션이 승인되면 `0002+`로 만든다.
- 2팀은 1.5 범위 파일(repo·enums·links·dashboard·projects 화면)을 수정하지 않는다. 2팀 새 파일 `src/lib/repo/highlights.ts`는 1.5에서 지우거나 옮기지 않는다.
- 사이드바 개편 때 2팀 "검색 ⌘K" 버튼 자리를 하나 남긴다(2팀이 개편 후 diff를 맞춤). `layout.tsx`·논문 화면·`PdfViewerClient` 연결 diff는 2팀 문서(`docs/p2/integration-*.md`) 기준으로 별도 배치에서 적용한다 — 1.5 B의 구현자 #4는 논문 화면에 보관 버튼만 넣고 그 외 구조는 바꾸지 않는다.
- `ITEM_TYPE`에 `area`가 추가되면 2팀 `search/text.ts`의 타입 맵은 2팀이 develop-p2에서 맞춘다.

## 5. 위험

- 마이그레이션 번호·journal 충돌(2팀) → 순서 합의, 병합 시 관리자가 `drizzle-kit generate`로 "No schema changes" 확인
- 보관 필터 누락으로 보관 항목이 목록·홈·연결 피커·검색에 보이는 문제 → repo `list()` 한 곳에서 기본 제외 + 테스트
- 사이드바 IA 변경으로 e2e 셀렉터 깨짐 → 테스터가 같은 배치에서 갱신
- 기존 사용자 데이터(실데이터 입력 전이지만) 보존 → 마이그레이션 테스트

## 6. 사용자 확인이 필요한 것 (권장안 기본)

1. 보관 동작: 프로젝트가 완료(제출 완료/완료)돼도 자동 보관하지 않고 목록에 "완료"로 남긴다. 보관은 사용자가 버튼으로(주간 검토 연동은 2단계) — 권장
2. 수집함에서 "정리됨"으로 만드는 방법: 태그를 달거나 연결하면 자동으로 빠짐(별도 체크 없음, Q8) — 확인만
3. "주제"는 문구만 바꾸고 URL `/tags`는 유지 — 권장
4. (2팀 검색 관련) 영역도 Cmd+K 검색 대상에 넣는다 — 권장
5. (2팀 검색 관련) 보관된 항목은 검색에 나오되 "보관됨" 배지를 붙인다(찾을 수는 있어야 하므로) — 권장. 다른 안: 검색에서 제외
