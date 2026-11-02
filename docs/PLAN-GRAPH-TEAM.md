# 단계 G — 담당과 파일 소유 (1팀)

> 근거: `docs/PLAN-GRAPH.md`(승인됨). 이 문서는 관리자 #1이 정한 실행 배정이다. 각 세션은 자기 소유 파일만 수정한다. 다른 파일이 필요하면 관리자에게 요청한다.

## 공통 규칙

- 작업은 자기 worktree에서. 프로젝트 루트(`/home/bgk/personal/Research-Cloud`, 사용자가 보는 develop)에서는 작업하지 않는다.
- 커밋은 작게, `feat(scope): …` 영어. 끝나면 관리자에게 브랜치·head·확인 결과 보고. 리뷰어 OK 전에는 병합하지 않는다.
- 확인은 lint·typecheck·관련 단위 테스트만. build·e2e 전체는 관리자만. dev 서버는 자기 전용 포트·임시 `DATA_DIR`, 끝나면 자기 PID만 종료.
- `.env` 읽기 금지. 로그에는 `describeError`(이름·code)만, 개인 데이터 금지. seed 인물명은 가짜.
- `package.json`/lock 변경은 관리자 승인 후 한 사람씩.
- **2팀이 고치는 중이라 손대지 않는 파일**: `src/app/layout.tsx`, `src/app/papers/**`(그래프·위키링크를 논문 화면에 붙이는 일은 2팀 병합 후 별도 배정). 사이드바(`src/components/shell/Sidebar*`)에 메뉴 추가도 2팀 병합 뒤.

## 마이그레이션

- 번호 `0002` 하나로 G 전체(goals, `projects.goal_id`, `links.via`, reviews, graph_layout). 2팀은 마이그레이션 없음.
- 구현자 A가 만든다. ADD COLUMN·CREATE TABLE만, 테이블 재작성 금지, 마이그레이션 테스트로 기존 값 보존 확인.
- develop에 들어가면 사용자에게 "루트에서 `npm run db:migrate` 필요"라고 보고한다(관리자가 직접 적용하지 않음).

## 결정 (관리자, 일상 기술 결정)

- 배지 톤: `goal` = red, `review` = gray. (2팀 검색 팔레트 테스트가 타입별 톤이 모두 달라야 하므로 기존 violet·blue·teal·amber·rose·green과 겹치지 않게.)
- 위키링크 `[[…]]`는 코드 블록·인라인 코드·인용(`>`) 안에서는 링크로 치지 않는다(라이너 메모 인용문 보호).
- `links.via` 기본 `manual`. 2팀 하이라이트 "생각 만들기"의 직접 insert는 그대로 manual.

## 담당

| 세션 | 단계 | 소유 파일 |
|---|---|---|
| 구현자 A | **G0 스키마(선행)** → G1 목표 → G4 위키링크 | `src/db/**`, `drizzle/**`, `src/lib/enums.ts`, `src/lib/repo/{goals,projects,links,items,shared}.ts`, `src/app/_actions/**`(목표·링크 관련), `src/app/goals/**`, `src/app/projects/**`(목표 선택), `src/components/editor/**`, `scripts/seed.ts`, 해당 테스트 |
| 구현자 B | G2 그래프 데이터 → G5 회고록 | `src/lib/graph/**`, `src/app/api/graph/**`, `src/lib/repo/{reviews,graph-layout}.ts`, `src/app/reviews/**`, `src/components/dashboard/**`·`src/app/page.tsx`(홈 "이번 주 회고" 한 줄), 회고 액션 `src/app/reviews/actions.ts`, 해당 테스트 |
| 구현자 C | G3 그래프 화면 | `src/app/graph/**`, `src/components/graph/**`(전체 그래프·로컬 그래프 컴포넌트), `src/components/shell/shortcuts.ts`·`Shortcuts.tsx`(단축키 G, 그래프 안 `/`), 그래프 라이브러리 추가(`package.json`), 해당 테스트. 각 상세 화면에 로컬 그래프 붙이기는 소유자에게 1줄 삽입을 요청하거나 관리자가 마지막에 배정 |
| 디자이너 | G3 디자인 | 그래프 시각 규칙 문서 `docs/design/graph.md`(노드 모양·크기·색 토큰·hover·라벨·PARA 열·로컬 그래프 배치·다크 모드), 이후 화면 검토. 코드 수정은 배정받을 때만 |
| 리뷰어 | 전체 | 수정 없음. 리뷰만 |

## 인터페이스 (B·C가 A를 기다리지 않도록)

- 그래프 데이터 (B가 정의, C가 사용): `GET /api/graph?types=&area=&tag=&archived=0|1&orphans=0|1` → `{ nodes: { id: "<type>:<id>", type, title, size, archived, areaId?, horizon? }[], edges: { source, target, kind: "belongs"|"link"|"body"|"topic" }[] }`, 로컬: `GET /api/graph/local?node=<type>:<id>&depth=1|2`. 레이아웃: `PUT /api/graph/layout` `{ positions: {node, x, y}[] }`, `DELETE /api/graph/layout`(초기화). B는 이 형태를 먼저 `src/lib/graph/types.ts`로 커밋해 C에 공유한다.
- 목표 노드는 A의 스키마가 들어오기 전엔 B가 빈 목록으로 처리.

## 순서

1. A의 G0 스키마 커밋 → 리뷰 → (B·C가 그 커밋을 merge해 사용)
2. A: G1, B: G2, C+디자이너: G3 — 동시에
3. A: G4(G1 뒤), B: G5(G2 뒤)
4. 2팀 병합 뒤: 사이드바 메뉴(그래프·목표·회고), 논문 상세 로컬 그래프 — 관리자가 배정
5. 통합 → 전체 점검 → 사용자 보고
