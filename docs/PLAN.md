# Research Brain — 전체 계획 (PLAN)

> 근거: `docs/SPEC.md` (확정 사항이 원문보다 우선). 이 문서를 사용자가 승인하기 전에는 구현을 시작하지 않는다.
> 이번 범위: **1단계 MVP만** — 데이터 모델, 4개 타입 CRUD, 다대다 연결, 양식, 홈 대시보드, PDF 뷰어 + 이어 읽기, 샘플 seed.
> 2·3단계(하이라이트 UI, 검색/Cmd+K, DOI 자동 채우기, 라이너 메모, 백링크, 태그 모아보기, 그래프, 내보내기)는 이번에 만들지 않는다. 단, 하이라이트 테이블은 "데이터 모델"에 포함되므로 스키마만 만든다.

## 1. 기술 결정

| 항목 | 결정 |
|---|---|
| 프레임워크 | Next.js 15 (App Router) + TypeScript + Tailwind CSS v4, `src/` 디렉터리 |
| 패키지 관리자 | npm (이 머신에 pnpm 없음) |
| DB | Drizzle ORM + `@libsql/client`. `DATABASE_URL` 없으면 `file:./data/local.db`, 있으면 Turso(`DATABASE_URL`, `DATABASE_AUTH_TOKEN`). `.env.example`만 작성, `.env`는 사용자가 직접 |
| 마이그레이션 | `drizzle-kit generate` → `drizzle/` 폴더에 SQL 커밋, `npm run db:migrate`로 적용 |
| 데이터 변경 | Server Actions (폼/버튼). 파일·고빈도 요청만 Route Handler (PDF 업로드·스트리밍, 읽기 위치 저장) |
| 본문 에디터 | Tiptap + `tiptap-markdown` — **본문은 마크다운 텍스트로 저장** (양식을 마크다운으로 정의, 3단계 Markdown 내보내기와 바로 호환) |
| PDF 뷰어 | `react-pdf` (pdf.js). 워커는 로컬 번들(외부 CDN 사용 안 함) |
| PDF 저장 | `data/pdfs/<paperId>.pdf` 로컬. 업로드는 PDF MIME/매직바이트 검사, 경로는 id로만 구성(사용자 파일명 미사용) |
| ID | `crypto.randomUUID()` 문자열 |
| 시각 | ISO 8601 문자열(UTC) 텍스트 컬럼, 날짜만 있는 필드는 `YYYY-MM-DD` |
| 폰트 | Pretendard + Inter, `next/font/local`로 자체 호스팅(패키지 `pretendard`, `@fontsource-variable/inter`) |
| 테스트 | Vitest (repo 계층은 `:memory:` libSQL로 단위 테스트), Playwright 스모크 e2e(관리자만 실행) |
| 린트 | ESLint(next 기본) + Prettier, `npm run lint`, `npm run typecheck` |

## 2. 폴더 구조

```
.
├─ drizzle/                    # 생성된 마이그레이션 SQL
├─ drizzle.config.ts
├─ .env.example                # DATABASE_URL=, DATABASE_AUTH_TOKEN= (빈 값)
├─ data/                       # gitignore — local.db, pdfs/
├─ scripts/
│  └─ seed.ts                  # 샘플 데이터 + 더미 PDF 생성 (npm run db:seed)
├─ public/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx            # 폰트, 테마, 사이드바 셸
│  │  ├─ globals.css           # 디자인 토큰(CSS 변수), 라이트/다크
│  │  ├─ page.tsx              # 홈 대시보드
│  │  ├─ projects/  page.tsx · new/page.tsx · [id]/page.tsx · actions.ts
│  │  ├─ papers/    page.tsx · new/page.tsx · [id]/page.tsx · [id]/read/page.tsx · actions.ts
│  │  ├─ seminars/  page.tsx · new/page.tsx · [id]/page.tsx · actions.ts
│  │  ├─ thoughts/  page.tsx · new/page.tsx · [id]/page.tsx · actions.ts
│  │  ├─ _actions/  links.ts · tags.ts · quick-thought.ts   # 공용 서버 액션
│  │  └─ api/
│  │     ├─ papers/[id]/pdf/route.ts       # GET 스트리밍, POST 업로드, DELETE
│  │     └─ papers/[id]/progress/route.ts  # PUT 읽기 위치 저장 (sendBeacon 대응)
│  ├─ db/
│  │  ├─ schema.ts
│  │  └─ client.ts             # env → libSQL 클라이언트 + drizzle 인스턴스
│  ├─ lib/
│  │  ├─ enums.ts              # 단계·상태·종류 값과 한국어 라벨, 배지 색
│  │  ├─ templates.ts          # 새 논문/세미나/연구 양식(마크다운)
│  │  ├─ repo/                 # 데이터 접근 계층 (UI는 이것만 호출)
│  │  │  ├─ projects.ts papers.ts seminars.ts thoughts.ts
│  │  │  ├─ links.ts tags.ts items.ts  # items: 타입 무관 조회(제목 lookup 등)
│  │  ├─ storage/pdf.ts        # data/pdfs 경로·읽기·쓰기·삭제
│  │  └─ hooks/useDebouncedCallback.ts
│  └─ components/
│     ├─ ui/                   # Button, Input, Select, Badge, Card, Table, Dialog, EmptyState …
│     ├─ shell/                # Sidebar, ThemeToggle, PageHeader, Shortcuts
│     ├─ editor/MarkdownEditor.tsx
│     ├─ fields/               # TagInput, DateField, EnumSelect
│     ├─ list/                 # ViewToggle(표/카드), ItemTable, ItemCards, TagFilter
│     ├─ links/                # ConnectedItems(연결 목록+추가/삭제), LinkPicker
│     ├─ pdf/                  # PdfViewer, ProgressBar
│     └─ dashboard/            # ContinueReading, ProjectKanban, RecentThoughts, RecentSeminars, QuickInput
└─ tests/
   ├─ unit/                    # vitest: repo, templates, storage
   └─ e2e/                     # playwright 스모크
```

## 3. Drizzle 스키마 (SQLite/libSQL)

공통 컬럼: `id text pk`, `created_at text`, `updated_at text`. 본문 `body text`(마크다운, 기본은 양식).

**projects** — `title`, `research_question`, `stage` (enum: `exploring` 주제 탐색 · `topic_set` 주제 확정 · `proposal` 제안서 작성 · `lit_review` 문헌 검토 · `data_collection` 데이터 수집 · `drafting` 초안 작성 · `revising` 수정·교정 · `submitted` 제출 완료), `start_date`, `due_date`, `body`

**papers** — `title`, `authors` (JSON 문자열 배열), `year int`, `venue`, `doi`, `url`, `pdf_path` (null 가능), `read_status` (`to_read` 읽을 예정 · `reading` 읽는 중 · `done` 다 읽음), `importance` (`core` 핵심 · `reference` 참고 · `light` 가볍게), `summary` (한 줄 요약), `last_page int`, `last_scroll real` (페이지 내 0~1 위치), `total_pages int`, `last_read_at`, `body`
 - 인덱스: `(read_status, last_read_at)` — 이어 읽기 조회용

**seminars** — `title`, `date`, `speaker`, `host_venue` (주최·장소), `kind` (`seminar` · `conference_talk` 학회 발표 · `lecture` 강의 · `webinar` · `other`), `key_line` (핵심 한 줄), `material_url`, `body`

**thoughts** — `title`, `kind` (`idea` 아이디어 · `question` 질문 · `critique` 비판·반론 · `connection` 연결 발견 · `memo` 메모), `maturity` (`seed` 씨앗 · `growing` 자라는 중 · `refined` 정리됨), `body`

**tags** — `id`, `name` (unique, 대소문자 무시 비교)
**item_tags** — `item_type` (`project|paper|seminar|thought`), `item_id`, `tag_id` → PK `(item_type, item_id, tag_id)`

**links** (다대다, 모든 타입 간) — `id`, `source_type`, `source_id`, `target_type`, `target_id`, `created_at`
 - 방향을 저장(만든 쪽 → 대상)해 2단계 백링크에 그대로 사용. 1단계 "연결된 항목"은 양방향을 합쳐 보여준다.
 - unique `(source_type, source_id, target_type, target_id)`, 자기 자신 연결 금지, 역방향 중복도 repo에서 막음.
 - 인덱스: `(target_type, target_id)`

**highlights** (스키마만, UI는 2단계) — `id`, `paper_id` (FK → papers, cascade), `page int`, `text`, `color`, `note`, `rects` (JSON, 페이지 좌표), `created_at`

다형 연결(links, item_tags)은 FK를 걸 수 없으므로, **항목 삭제는 repo에서 트랜잭션으로 links·item_tags·(논문이면) PDF 파일까지 함께 정리**한다.

### repo 인터페이스 (UI 작업자가 이 시그니처에 맞춰 병행 개발)
```ts
type ItemType = 'project' | 'paper' | 'seminar' | 'thought'
type ItemRef = { type: ItemType; id: string }
// 타입별: list({ tag?, status/stage/kind? , sort? }), get(id), create(input), update(id, patch), remove(id)
// papers 추가: setPdf(id, path, totalPages?), saveProgress(id, { page, scroll, totalPages }), listContinueReading(limit)
//   saveProgress는 read_status가 to_read면 reading으로 바꾸고 last_read_at 갱신
// projects 추가: listByStage()  (submitted 제외 옵션)
// links: link(a: ItemRef, b: ItemRef), unlink(a, b), listConnected(ref) → { ref, title, type }[]
// tags: setTags(ref, names[]), getTags(ref), listAll() → { name, count }[]
// items: searchTitles(query, excludeRef?) → LinkPicker용 제목 검색 (본문 검색 아님)
```

## 4. 화면 목록 (1단계)

| 경로 | 화면 | 내용 |
|---|---|---|
| `/` | 홈 대시보드 | 상단 빠른 입력(엔터 → 생각 `memo`/`seed`로 저장), 이어 읽기(읽는 중 논문 최근순, 진행률 바, 클릭 시 뷰어로), 진행 중인 연구 단계별 칸반, 최근 생각, 최근 세미나 |
| `/projects` `/papers` `/seminars` `/thoughts` | 목록 | 표/카드 보기 전환(선택 기억: localStorage), 상태·종류·단계 필터, 태그 필터, 정렬 |
| `/<type>/new` | 새 항목 | 필드 폼 + 본문은 해당 양식으로 미리 채움(논문·세미나·연구), 저장 후 상세로 |
| `/<type>/[id]` | 상세/편집 | 필드 인라인 편집, 마크다운 에디터, 태그 입력, 하단 "연결된 항목"(추가: 제목 검색 피커, 삭제), 삭제(확인 대화상자) |
| `/papers/[id]` | 논문 상세 | 위 + PDF 업로드/교체/삭제, "이어 읽기" 버튼(마지막 페이지 표시), 진행률 |
| `/papers/[id]/read` | PDF 뷰어 | 연속 스크롤, 페이지 이동, 확대/축소, 스크롤 시 현재 페이지+페이지 내 위치를 디바운스(약 800ms) 저장, 탭 닫힘·이탈 시 `sendBeacon`으로 마지막 저장, 다시 열면 그 위치로 바로 이동 |

공통: 왼쪽 사이드바(홈/연구/논문/세미나/생각/태그), 라이트/다크 토글(시스템 기본), 단축키 `N` 현재 섹션 새 항목, `/` 홈 빠른 입력 포커스. UI 문구 전부 한국어. 디자인: 무채색 + 포인트 색 1개, 얇은 구분선, 그림자 최소, 모서리 8px, 상태·종류는 은은한 배지.

**seed** (`npm run db:seed`, 기존 샘플만 지우고 다시 넣음): 연구 3, 논문 5(그중 2개 읽는 중 + 진행 위치), 세미나 3, 생각 5, 태그 몇 개, 연결 6~8개. PDF는 저작권 문제를 피하려고 `pdf-lib`으로 만든 **10쪽짜리 더미 PDF**를 `data/pdfs/`에 생성. 인물명은 가짜 이름, 이메일 없음.

## 5. 역할 분담과 순서

통합 브랜치: `develop` (main에서 분기, 로컬). 관리자만 develop에 병합. 각 단계는 리뷰어 OK 후 병합.

**A0 — 뼈대 (impl-2 단독, 짧게)**: Next/TS/Tailwind/ESLint/Prettier/Vitest 설정, 1단계 의존성 전부 `package.json`에 미리 추가, `npm run dev|build|lint|typecheck|test|db:generate|db:migrate|db:seed` 스크립트. → review-5 → develop 병합. (이후 `package.json`은 관리자 승인 하에 impl-2만 수정)

**A — 기반 (병렬, 서로 다른 파일)**
| 담당 | 범위(소유 파일) | 리뷰 |
|---|---|---|
| impl-2 | `src/db/**`, `drizzle/**`, `drizzle.config.ts`, `.env.example`, `src/lib/{enums,templates}.ts`, `src/lib/repo/**`, `scripts/seed.ts`, `tests/unit/repo*` | review-5 |
| impl-3 | `src/app/{layout.tsx,globals.css}`, `src/components/{ui,shell,editor,fields,list}/**` — 디자인 시스템·셸·에디터·공용 입력 | review-6 |
| impl-4 | `src/lib/storage/**`, `src/lib/hooks/**`, `src/components/pdf/**`, `src/app/api/papers/**` — PDF 저장·스트리밍·업로드·진행 저장 API, 뷰어 컴포넌트 | review-5 |

**B — 화면 (A 병합 후 병렬)**
| 담당 | 범위 | 리뷰 |
|---|---|---|
| impl-2 | `src/components/links/**`, `src/app/_actions/**` (연결·태그·빠른 입력 액션) — 먼저 끝내 B 화면에 공급 | review-5 |
| impl-3 | `src/app/{projects,seminars,thoughts}/**` 목록·새로·상세 | review-6 |
| impl-4 | `src/app/papers/**`(뷰어 페이지 포함), `src/app/page.tsx`, `src/components/dashboard/**` | review-5 |

**테스트·문서**
- test-7: A 병합 후 `tests/unit/**`(templates, storage, repo 보강), B 병합 후 `tests/e2e/**` Playwright 스모크(CRUD 1회씩, 연결 추가, PDF 열기→스크롤→재오픈 시 위치 복원, 빠른 입력). 단일 파일만 실행, 전체 실행은 관리자. 리뷰 review-6.
- docs-8: B 진행 중 `README.md`(설치, `.env` 설정 방법, migrate/seed/dev 실행, Turso 전환, 1단계 확인 체크리스트). 리뷰 review-6.

**병합 순서**: A0 → (A: impl-2 → impl-4 → impl-3) → 전체 점검 1회 → (B: impl-2 links/actions → impl-3 → impl-4 → test-7 → docs-8) → 전체 점검(빌드·린트·타입·유닛·e2e) 1회 → 사용자 보고 후 멈춤. push는 사용자 OK 후에만.

## 6. 위험 요소

- **PDF 위치 복원 정확도**: 페이지 높이가 렌더 전에 정해지지 않으면 점프가 어긋남 → 첫 페이지 크기로 자리 높이를 먼저 잡고, 페이지 번호 + 페이지 내 비율로 복원.
- **pdf.js 워커/SSR**: 뷰어는 클라이언트 전용(dynamic import, ssr:false), 워커는 로컬 번들.
- **다형 연결 무결성**: FK 없음 → 삭제 시 repo 트랜잭션 정리 + 유닛 테스트로 보장.
- **Turso 원격 지연**: 진행 저장은 디바운스 + 마지막 1회 beacon으로 요청 수 제한.
- **공유 파일 충돌**: `package.json`, `layout.tsx`는 소유자 단일화. 다른 사람이 필요하면 관리자를 통해 요청.
- **개인정보**: seed는 가짜 이름만, 이메일 저장 없음. `.env` 읽기 금지.

## 7. 사용자 확인이 필요한 결정 (권장안을 기본값으로 진행)

1. **본문 저장 형식**: 마크다운 텍스트 (권장) / Tiptap JSON
2. **사이드바 "태그"**: 1단계는 항목별 태그 입력 + 목록 화면 태그 필터 + 태그 페이지는 "태그 목록(개수)·클릭하면 해당 태그 항목 목록"의 최소 형태 (권장) / 태그 페이지 전체를 2단계로 미룸
3. **연구 칸반**: 단계 열에 카드 표시, 단계 변경은 카드 상세/선택 상자로 — 드래그 앤 드롭 없음 (권장) / 드래그 앤 드롭 포함
4. **단축키**: 1단계는 `N`, `/`만. `Cmd+K`는 검색과 함께 2단계 (권장)
5. **샘플 PDF**: 생성한 더미 PDF (권장) / 사용자가 넣은 PDF 사용
