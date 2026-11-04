# 계획: 백업·코드 색칠·노트 템플릿·버그 (단계 P)

> **승인됨 (2026-11-04)**. 기준 develop `eed17b7`. 새 의존성 최소, `src/app/loading.tsx` 금지, push·배포 없음. 마이그레이션이 필요하면 루트 DB에 적용하지 않고 보고.

## 1. 자동 백업 (로컬 모드)

- 대상: DB(`local.db`) — **`VACUUM INTO`**(또는 libSQL backup API)로만, 파일 복사 금지. `DATA_DIR`의 `pdfs/`·`images/`.
- 위치: `BACKUP_DIR`(기본 `data/backups/`, gitignore) 아래 `YYYY-MM-DD[-HHmm]/`. 최근 14개만 남기고 오래된 것부터 지움(백업 폴더 형식에 맞는 것만).
- 언제: 서버 시작 시 마지막 백업이 24시간 넘었으면 + 서버가 떠 있는 동안 하루 1회(`instrumentation.ts`, Node 런타임만, 동시에 두 번 안 돌게 잠금). 수동 `npm run backup`.
- Turso 모드: DB 백업은 건너뛰고 "Turso는 자체 백업(시점 복구)을 쓰세요" 안내만, 파일은 백업. Vercel에서는 아무것도 안 함.
- 실패해도 앱은 계속. 로그는 "백업 실패(단계명)" 정도만 — 경로·내용·비밀값 노출 금지.
- README: 백업 위치, 수동 실행, **복원 방법**(서버 끄고 DB 파일·폴더 되돌리기).
- 테스트: 임시 폴더에서 VACUUM INTO 결과를 열어 행 확인, 14개 유지, 24시간 판단, Turso 분기.

## 2. 코드 블록 문법 색칠

- 에디터와 읽기 화면 모두. `@tiptap/extension-code-block-lowlight` + `lowlight`(필요 언어만 등록: bash·shell, yaml, xml(launch 포함 별칭), cpp·c, python, json, ts·js, 그 밖은 일반 텍스트). 자동 감지 없음.
- 색은 CSS 변수(라이트/다크) — 디자이너 값. 복사 버튼(가능하면).
- Markdown 왕복 ```` ```lang ```` 보존 테스트 필수(언어 없음, 모르는 언어 포함).
- 번들: 색칠은 에디터 청크에만, 언어 묶음 전체(`common`/`all`) 금지.

## 3. 노트 템플릿

- `/notes/new`에서 템플릿 선택: 빈 페이지 / 작업 로그 / 개념 정리 / 에러 해결 / 강의·책 요약. 코드 상수(`src/lib/templates.ts`).
- 작업 로그: 본문 첫 줄 `## YYYY-MM-DD`(서울 날짜, `seoulDate`), 에러 해결: `증상 / 원인 / 해결 / 참고` 칸. 문구는 디자이너.
- 사용자 편집 기능 없음.

## 4. 남은 버그

| 버그 | 담당 |
|---|---|
| 그래프 첫 화면 맞춤(아래 노드가 화면 밖) | C |
| 로컬 그래프 가장자리 잘림 | C |
| 선택 시 이웃 라벨 겹침 | C |
| 할 일 끌어 놓기 오차(다른 기기에서 순서 바뀐 경우, 끄는 중 스크롤) | C |
| ICS 시간 테스트가 전체 실행 시 2초 초과(시간 대신 반복 횟수로 검사하거나 제한 조정) | A |
| R2 모드에서 MIME 없는 붙여넣기 사진 업로드 실패(매직바이트로 판정) | A |

## 5. 담당

| 담당 | 범위(소유 파일) |
|---|---|
| 구현자 A | 1 전체(`src/lib/backup/**`, `scripts/backup.ts`, `src/instrumentation.ts`, `.gitignore`, `.env.example`, README 백업 절, `package.json`의 `backup` 스크립트 한 줄), 4의 ICS 테스트(`tests/unit/calendar-ics*`, 필요하면 `src/lib/calendar/ics/**`), R2 붙여넣기(`src/lib/storage/**`, `src/app/api/uploads/**`, `src/components/editor/image-upload.ts`) |
| 구현자 B | 2·3(`src/components/editor/**` 단 `image-upload.ts` 제외, 읽기 화면 렌더러, `globals.css` 코드 색 변수, `package.json` 의존성, `src/lib/templates.ts`, `src/app/notes/new/**`) |
| 구현자 C | 4의 그래프·할 일(`src/components/graph/**`, `src/lib/graph/**`, `src/components/tasks/**`, 필요하면 `src/app/_actions/tasks.ts`) |
| 디자이너(짧게) | `docs/design/code.md`(코드 색 라이트/다크, 대비 4.5:1, 복사 버튼), 템플릿 5종 문구 |
| 리뷰어 | 전체. 백업 안전성(VACUUM INTO, 지우기 범위, 경로 노출), 번들 크기, 왕복 보존, 업로드 검증 |

`package.json`은 A(스크립트 한 줄)와 B(의존성)가 함께 건드린다 — 병합 때 관리자가 맞춘다.
