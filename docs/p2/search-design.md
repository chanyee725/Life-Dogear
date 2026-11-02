# 전체 검색(Cmd+K) 설계 — 2단계 작업 C

> 작성: impl-12 · 2026-11-02 · 대상 브랜치 `develop-p2`

## 결론

- **지금 구현: 스키마 변경 없는 `LIKE` 부분 문자열 검색** (`src/lib/search/like-engine.ts`).
  개인 규모(수백~수천 건)에서는 전체 스캔으로도 충분히 빠르고, 로컬 파일 DB와 Turso(libSQL) 어디서나 똑같이 동작한다.
- **FTS5는 마이그레이션 제안으로만 둔다** (아래 SQL, 실제 마이그레이션 파일·`drizzle/` 저널·`schema.ts`는 건드리지 않음).
  한국어 검색에 쓸 수 있는 토크나이저는 trigram뿐인데 trigram은 **3글자 미만 검색어를 찾지 못한다**. "모델", "학습", "주의"처럼 두 글자 한국어 검색이 흔하므로, FTS5를 넣어도 LIKE 대체 경로가 꼭 필요하다. 데이터가 커져 체감 속도가 문제될 때 도입하는 것을 권한다.
- 검색 백엔드는 `SearchEngine` 인터페이스(`src/lib/search/types.ts`)로 분리했다. FTS 엔진을 만들면 `setSearchEngine()`으로 바꾸면 되고, 호출부(`searchAll`, API, 팔레트)는 그대로다.

## 확인한 사실

### 로컬 `@libsql/client` 파일 DB (직접 실행, `/tmp` 스크립트)

`@libsql/client` 0.18 (lockfile 기준), `file:` DB, 내장 SQLite 3.45.1.

| 확인 항목 | 결과 |
|---|---|
| `sqlite_compileoption_used('ENABLE_FTS5')` | 1 (사용 가능) |
| `fts5(...)` 기본(unicode61) 생성·검색 | 됨. 단 한국어는 **띄어쓰기 단위 토큰**이라 `자연어처리`의 `자연어`, `메커니즘을`의 `메커니즘`을 **찾지 못함** |
| `fts5(..., tokenize='trigram')` | 됨. `자연어`, `메커니즘`, `ATTENTION`(대소문자 무시) 모두 찾음 |
| trigram에 1~2글자 검색어 | **결과 없음** (trigram은 3글자 이상만 색인) |
| `snippet()` | 됨 (`… [메커니즘]을 …`) |
| SQL `lower()` / `LIKE` | ASCII만 대소문자 무시 (`'Ä' like 'ä'` = 0). 한국어는 대소문자 개념이 없어 영향 없음 |

아래 "FTS5 마이그레이션 제안" SQL(external-content 판)도 실제 `drizzle/0000_new_ricochet.sql`을 적용한 `:memory:` DB에서 실행해 확인했다(결과 표는 그 절에).

### Turso (공식 자료)

- Turso 문서 "SQLite Extensions"는 FTS5를 **항상 켜져 있는(preloaded) 확장**으로 적어 둔다: "The following extensions are always-on and available: … FTS5 | Built-in | Full-text search and indexing."
  — <https://docs.turso.tech/features/sqlite-extensions>
- trigram 토크나이저 지원 여부는 이 문서에 **나와 있지 않다**(확인 안 됨). trigram은 SQLite 3.34+ 기능이라 동작할 가능성은 있지만, 실제 Turso DB에서 확인한 것은 아니다.
- 별개 제품인 **Turso Database(SQLite를 Rust로 새로 구현한 것, libSQL 아님)**는 FTS3/4/5를 지원하지 않고 Tantivy 기반 자체 FTS(`CREATE INDEX … USING fts`)를 쓴다: "Turso implements FTS using Tantivy instead of SQLite's FTS3/FTS4/FTS5."
  — <https://github.com/tursodatabase/turso/blob/main/COMPAT.md>, <https://docs.turso.tech/sql-reference/functions/fts>
  이 앱은 `@libsql/client`(libSQL)를 쓰므로 직접 해당하지는 않지만, 나중에 엔진을 바꾸면 FTS5 SQL은 쓸 수 없다.
- libSQL TypeScript 클라이언트에서 FTS5 테이블에 **이름 붙은 파라미터로 INSERT하면 panic**한다는 보고가 열려 있다(2024-11 등록, 2026-11 현재 Open).
  — <https://github.com/tursodatabase/libsql/issues/1811>
  아래 제안처럼 **트리거로만 색인을 채우면** 앱이 FTS 테이블에 직접 파라미터 INSERT를 하지 않으므로 이 문제를 피할 수 있다(검색 `MATCH ?`는 위치 파라미터).

→ LIKE 방식은 위 불확실성(trigram, 클라이언트 버그, 엔진 차이)과 무관하게 동작한다. 이것도 LIKE를 기본안으로 고른 이유다.

## 현재 구현 (LIKE)

| 항목 | 내용 |
|---|---|
| 대상 | 프로젝트: 제목·연구 질문·다음 할 일·본문 / 영역: 제목·유지 기준·본문 / 논문: 제목·저자·한 줄 요약·학회지·본문 / 세미나: 제목·핵심 한 줄·발표자·주최·본문 / 생각: 제목·본문 / 하이라이트: 선택 텍스트·메모(+논문 제목, 페이지) |
| 정규화 | 검색어는 NFC + 앞뒤 공백 제거 + 연속 공백 하나로, 최대 200자(UTF-16 단위, **글자(그래핌) 경계에서** 자름 — 이모지·ZWJ 시퀀스를 반쪽으로 남기지 않음). macOS에서 붙여넣어 **NFD로 저장된 텍스트**도 찾도록 NFC·NFD 두 형태로 LIKE |
| 이스케이프 | `%` `_` `\`를 `\`로 이스케이프하고 `escape '\'` 사용 → `95%`, `snake_case`가 문자 그대로 검색됨 |
| 저자(JSON) | `authors`는 JSON 배열 원문이 아니라 화면에 보이는 `A, B` 형태로 SQL에서 바꿔 비교 → `"` `[` 검색이 모든 논문에 걸리지 않음. 이름 안의 이스케이프 문자(`\"`)는 JS 재확인에서 걸러짐 |
| 대소문자 | SQL `lower()`는 ASCII만 소문자로 바꾸므로 LIKE 패턴을 두 벌 보낸다: **ASCII만** 소문자화한 것(`Österreich`가 자기 자신을 찾음)과 **전체** 소문자화한 것(`ÖSTERREICH`, `МОДЕЛЬ`이 소문자로 저장된 `österreich`, `модель`을 찾음). 최종 일치 판정·스니펫은 JS `toLowerCase()`(유니코드 전체) |
| 순위 | 제목 정확히 일치(100) > 제목 접두(80) > 제목 포함(60) > 주요 필드(40) > 하이라이트 텍스트(35) > 하이라이트 메모(30) > 본문(20). 동점은 **보관 안 된 항목 먼저**, 그다음 최근 수정(하이라이트는 생성) 순 (`text.ts`의 `compareHits` — 엔진 공통) |
| 보관 | 보관(`archived_at`)된 항목도 검색된다. 결과마다 `archived`(하이라이트는 소속 논문의 보관 여부)를 넣고 팔레트가 회색 "보관됨" 배지를 붙인다. 보관 여부로 점수를 깎거나 숨기지 않는다 |
| 스니펫 | 일치 부분 앞 약 30자·뒤 약 60자, 창 경계는 `Intl.Segmenter` 그래핌 경계로 맞춤(없으면 서로게이트 쌍 경계). 본문은 마크다운 기호를 걷어낸 텍스트에서. `{ before, match, after }`로 나눠 반환해 UI가 HTML 없이 `<mark>`로 감쌈 |
| 성능 | 출처(4개 타입+하이라이트)마다 최대 **50행**을 가져와 JS에서 순위를 매김. 제목 일치를 SQL에서 먼저 정렬해 상한에 잘리지 않게 함. 본문은 SQL에서 `instr`/`substr`로 **첫 일치 주변 약 300자 창만** 가져오고, 제목·주요 필드가 맞은 행은 본문을 아예 보내지 않음 |
| 한계 | **소문자 비ASCII 검색어로 대문자 원문은 못 찾음**(`österreich`로 `Österreich`). 여러 단어 검색어는 **구 전체**를 부분 문자열로 찾음(단어별 AND 아님) |

하이라이트 결과의 링크는 `readerHref(paperId, page, scrollTargetFor(rects))`(`src/lib/highlights`)로 만들어 페이지 안의 하이라이트 위치(`?page=N&scroll=S`)로 바로 간다. 좌표가 없거나 깨졌으면 그 페이지 맨 위.

진입점: `GET /api/search?q=…&limit=…` → `{ hits }` (same-origin 검사, `cache-control: no-store`, 오류 로그에 검색어를 남기지 않음).

## 영역(area)과 보관 (1.5단계 반영, develop-p2 b7ac924 기준)

사용자 결정(PLAN-1.5 §6-4·5): 영역도 Cmd+K 검색 대상, 보관 항목은 검색에 나오되 "보관됨" 배지.

Cmd+K 검색은 PLAN-1.5 §6-5에 따라 **보관 항목을 포함**한다(배지로 표시). 보관 항목을 기본 제외하는 것은 1팀의 연결 피커(제목 검색) 쪽뿐이다.

| 위치 | 반영 |
|---|---|
| `src/lib/search/text.ts` `itemHref` | 자체 `DETAIL_BASE` 대신 1팀 `ITEM_ROUTE`(`src/lib/enums.ts`, `area: "/areas"`)를 쓴다. 타입이 늘어도 경로 맵을 따로 맞출 필요 없음 |
| `src/lib/search/like-engine.ts` `SOURCES` | `areas`: 제목 / `standard`(유지 기준) / 본문. 영역 상세 `/areas/[id]` |
| 같은 파일, 프로젝트 | 주요 필드에 `next_action`(다음 할 일) 추가 — 목록·홈·상세에 보이는 한 줄이라 "보이는 글은 찾을 수 있다"에 맞춤. `kind`·`status`·`area_id`·`completed_at`은 값이 enum/id/날짜라 텍스트 검색 대상이 아님 |
| `SearchHit.archived` | `archived_at IS NOT NULL`. 하이라이트는 `papers.archived_at` |
| 순위 | 점수 그대로. 같은 점수에서만 보관 안 된 항목이 앞(보관은 "지금 안 보는 것"이라 동률이면 현재 항목을 먼저 보여 주되, 더 잘 맞는 보관 항목을 밀어내지는 않음) |
| 팔레트 | 제목 오른쪽에 `<Badge tone="gray">보관됨</Badge>`(1팀 `ConnectedItems`와 같은 모양). 안내 문구 "프로젝트·영역·논문·세미나·생각…" |
| 테스트 | `tests/unit/search.test.ts` "areas and archived items": 영역 제목·유지 기준·본문, 다음 할 일, 4타입·영역 보관 플래그와 해제, 동률 정렬, 보관 논문의 하이라이트 |

배지 색: 1.5에서 area가 `rose`를 가져가 팔레트의 하이라이트 배지(원래 `rose`)와 겹쳤다. 하이라이트는 `green`(`HIGHLIGHT_TONE`, `ITEM_TYPE` 톤과 겹치지 않는 값)으로 바꾸고, 결과 타입마다 톤이 다른지 `tests/unit/search-palette.test.ts`가 확인한다.

## FTS5 마이그레이션 제안 (적용하지 않음)

1팀 마이그레이션과 충돌하지 않도록, 1단계 병합 후 `drizzle-kit generate --custom`으로 빈 마이그레이션을 만들어 아래 내용을 넣는 방식을 제안한다.

설계:

- **external-content** 테이블(`content='papers', content_rowid='rowid'`): 색인에 본문 사본을 두지 않고, 원본 테이블의 암묵적 `rowid`로 행을 잇는다. 원본 열 이름과 FTS 열 이름이 같아야 하므로 **출처마다 FTS 테이블 하나**를 둔다(`papers_fts`, `highlights_fts`, 같은 모양으로 `projects_fts`(title, research_question, next_action, body), `areas_fts`(title, standard, body), `seminars_fts`(title, key_line, speaker, host_venue, body), `thoughts_fts`(title, body)). 현재 엔진도 출처별로 조회하므로 구조가 맞는다.
- 삭제·수정은 FTS5의 `'delete'` 명령에 **이전 값**을 넘겨 색인에서 뺀다(external-content 규칙).
- 수정 트리거는 **`AFTER UPDATE OF <색인 열 목록>`**: 읽기 위치 저장(`saveProgress`: `last_page`·`last_scroll`·`last_read_at`·`read_status`·`total_pages`)이나 PDF 교체(`pdf_path`)에는 트리거가 돌지 않는다.
- 기존 행은 `'rebuild'` 명령으로 한 번에 색인.

```sql
-- External-content FTS5: the index stores no copy of the text; rows map to the
-- source table through its implicit rowid. One index per source keeps columns aligned.
CREATE VIRTUAL TABLE papers_fts USING fts5(
  title, authors, summary, venue, body,
  content = 'papers', content_rowid = 'rowid', tokenize = 'trigram'
);
--> statement-breakpoint
CREATE TRIGGER papers_fts_ai AFTER INSERT ON papers BEGIN
  INSERT INTO papers_fts(rowid, title, authors, summary, venue, body)
  VALUES (new.rowid, new.title, new.authors, new.summary, new.venue, new.body);
END;
--> statement-breakpoint
CREATE TRIGGER papers_fts_ad AFTER DELETE ON papers BEGIN
  INSERT INTO papers_fts(papers_fts, rowid, title, authors, summary, venue, body)
  VALUES ('delete', old.rowid, old.title, old.authors, old.summary, old.venue, old.body);
END;
--> statement-breakpoint
-- Only the indexed columns: saving the reading position (last_page, last_scroll,
-- last_read_at, read_status) does not touch the index.
CREATE TRIGGER papers_fts_au AFTER UPDATE OF title, authors, summary, venue, body ON papers BEGIN
  INSERT INTO papers_fts(papers_fts, rowid, title, authors, summary, venue, body)
  VALUES ('delete', old.rowid, old.title, old.authors, old.summary, old.venue, old.body);
  INSERT INTO papers_fts(rowid, title, authors, summary, venue, body)
  VALUES (new.rowid, new.title, new.authors, new.summary, new.venue, new.body);
END;
--> statement-breakpoint
CREATE VIRTUAL TABLE highlights_fts USING fts5(
  text, note,
  content = 'highlights', content_rowid = 'rowid', tokenize = 'trigram'
);
--> statement-breakpoint
CREATE TRIGGER highlights_fts_ai AFTER INSERT ON highlights BEGIN
  INSERT INTO highlights_fts(rowid, text, note) VALUES (new.rowid, new.text, new.note);
END;
--> statement-breakpoint
CREATE TRIGGER highlights_fts_ad AFTER DELETE ON highlights BEGIN
  INSERT INTO highlights_fts(highlights_fts, rowid, text, note)
  VALUES ('delete', old.rowid, old.text, old.note);
END;
--> statement-breakpoint
CREATE TRIGGER highlights_fts_au AFTER UPDATE OF text, note ON highlights BEGIN
  INSERT INTO highlights_fts(highlights_fts, rowid, text, note)
  VALUES ('delete', old.rowid, old.text, old.note);
  INSERT INTO highlights_fts(rowid, text, note) VALUES (new.rowid, new.text, new.note);
END;
--> statement-breakpoint
-- Areas (phase 1.5): same shape. archived_at is not indexed — archived rows stay
-- searchable and the engine reads archived_at from the source row.
CREATE VIRTUAL TABLE areas_fts USING fts5(
  title, standard, body,
  content = 'areas', content_rowid = 'rowid', tokenize = 'trigram'
);
--> statement-breakpoint
CREATE TRIGGER areas_fts_ai AFTER INSERT ON areas BEGIN
  INSERT INTO areas_fts(rowid, title, standard, body)
  VALUES (new.rowid, new.title, new.standard, new.body);
END;
--> statement-breakpoint
CREATE TRIGGER areas_fts_ad AFTER DELETE ON areas BEGIN
  INSERT INTO areas_fts(areas_fts, rowid, title, standard, body)
  VALUES ('delete', old.rowid, old.title, old.standard, old.body);
END;
--> statement-breakpoint
-- Reordering (sort_order) and archiving (archived_at) do not touch the index.
CREATE TRIGGER areas_fts_au AFTER UPDATE OF title, standard, body ON areas BEGIN
  INSERT INTO areas_fts(areas_fts, rowid, title, standard, body)
  VALUES ('delete', old.rowid, old.title, old.standard, old.body);
  INSERT INTO areas_fts(rowid, title, standard, body)
  VALUES (new.rowid, new.title, new.standard, new.body);
END;
--> statement-breakpoint
-- Index rows that existed before this migration.
INSERT INTO papers_fts(papers_fts) VALUES ('rebuild');
--> statement-breakpoint
INSERT INTO highlights_fts(highlights_fts) VALUES ('rebuild');
--> statement-breakpoint
INSERT INTO areas_fts(areas_fts) VALUES ('rebuild');
```

(`projects_fts`·`seminars_fts`·`thoughts_fts`도 같은 모양. 프로젝트 수정 트리거는 `AFTER UPDATE OF title, research_question, next_action, body`로 두어 `status`·`stage`·`area_id`·`archived_at` 변경에는 돌지 않게 한다.) 번호는 1팀 `0001_para_skeleton` 다음인 `0002+`.

조회 예: `SELECT p.id FROM papers_fts f JOIN papers p ON p.rowid = f.rowid WHERE papers_fts MATCH ? ORDER BY rank`.

`MATCH ?`에 넘기는 값은 반드시 **구문(phrase)으로 감싼다**: `"` + 검색어의 `"`를 `""`로 바꾼 것 + `"`. 그대로 넘기면 `AND`·`OR`·`NEAR`·`*`·`:`·`-` 등이 FTS 쿼리 문법으로 해석돼 오류가 나거나 다른 결과가 나온다(아래 "FTS 엔진 구현 시 주의"와 같은 내용).

검증(2026-11-02, `drizzle/0000_new_ricochet.sql`을 적용한 `:memory:` DB, `/tmp` 스크립트; `areas_fts`는 아래 별도 확인):

| 항목 | 결과 |
|---|---|
| 기존 행 `rebuild` 백필 | 됨 |
| 삽입 후 `자연어`·`메커니즘`(trigram 부분 일치), 하이라이트 텍스트·메모 | 찾음 |
| 읽기 위치만 바꾸는 UPDATE(`last_page`, `last_scroll`, `last_read_at`, `read_status`) | `total_changes()` 증가 1 → **트리거 작업 없음** |
| 제목 UPDATE | `total_changes()` 증가 9 → 트리거 실행, 옛 제목은 안 찾아지고 새 제목은 찾아짐 |
| 논문 삭제(하이라이트 FK cascade 포함) | 두 색인 모두에서 빠짐 |
| `INSERT INTO …_fts(…_fts, rank) VALUES ('integrity-check', 1)` | 두 색인 모두 통과 |

`areas_fts` 확인(2026-11-02, `drizzle/0000`·`0001`을 적용한 `:memory:` DB에서 위 SQL 블록 전체 실행, `/tmp` 스크립트):

| 항목 | 결과 |
|---|---|
| 기존 영역 `rebuild` 백필 | 찾음 |
| 새 영역 삽입 → 유지 기준 검색 | 찾음 |
| `sort_order`·`archived_at`만 바꾸는 UPDATE | 트리거 작업 없음(`total_changes()` 증가 1) |
| 유지 기준 수정 / 영역 삭제 | 옛 값 빠지고 새 값 찾음 / 색인에서 빠짐 |
| `integrity-check`(`areas_fts`·`papers_fts`·`highlights_fts`) | 통과 |

FTS 엔진 구현 시 주의:

- 검색어가 **3글자 미만이면 LIKE 엔진으로 위임**한다(trigram 한계).
- 검색어는 FTS 쿼리 문법으로 해석되지 않게 `"…"`로 감싸고 내부 `"`는 `""`로 바꾼다.
- **rowid 안정성**: 이 테이블들은 `INTEGER PRIMARY KEY`가 없어(`id`는 text) SQLite 문서상 `VACUUM`이 rowid를 바꿀 수 있다(<https://www.sqlite.org/lang_vacuum.html>). 그러면 external-content 매핑이 어긋나므로, `VACUUM` 뒤에는 각 FTS 테이블에 `'rebuild'`를 실행해야 한다. 이 부담이 싫으면 content 테이블을 쓰지 않는(사본 저장) FTS 테이블 + `ref_id` 열 방식이 대안이다(이전 제안안).
- **drizzle-kit 테이블 재생성 마이그레이션 주의**: SQLite에서 열 타입·제약을 바꾸면 drizzle-kit(`LibSQLRecreateTableConvertor`, 이 저장소의 `node_modules/drizzle-kit`에서 확인)은 `PRAGMA foreign_keys=OFF` → `CREATE TABLE __new_<t>` → `INSERT INTO __new_<t>(<열>) SELECT <열> FROM <t>` → `DROP TABLE <t>` → `ALTER TABLE __new_<t> RENAME TO <t>` 순서의 SQL을 만든다. 이때 (1) `DROP TABLE`이 그 테이블의 **트리거를 조용히 함께 지우고**, (2) `rowid`를 열 목록에 넣지 않으므로 **rowid가 새로 매겨진다**(삭제로 생긴 빈 번호가 당겨짐). 메모리 DB에서 같은 순서를 재현한 결과: 트리거 3개 → 0개, 중간 행 하나를 지운 상태에서 `p3`의 rowid 3 → 2, 그 행이 검색에서 빠짐(다른 행을 가리킬 수도 있음), 재생성 뒤 새로 넣은 행은 색인되지 않음. → 이런 마이그레이션 바로 뒤에 **같은 마이그레이션 안에서 `…_fts_ai/ad/au` 트리거를 다시 만들고 `INSERT INTO …_fts(…_fts) VALUES ('rebuild')`를 실행**해야 한다(재현에서 이후 검색·새 행 색인·integrity-check 모두 정상). 생성된 마이그레이션 SQL에 `__new_`가 보이면 이 단계를 넣었는지 확인할 것.
- 정렬은 `bm25(papers_fts, 10.0, 4.0, 2.0, 1.0, 1.0)`(제목 가중) 또는 현재처럼 JS 점수로.
- Turso에서 trigram 동작을 먼저 확인할 것(공식 문서 미기재). 안 되면 FTS 도입을 보류하고 LIKE 유지.
