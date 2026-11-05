# PLAN-CAL-WRITE — 할 일 달력 숨김 + 구글 캘린더 쓰기

기준: `develop` f140238. 팀: 구현자 A·B, 리뷰어 1. push 금지, 병합은 관리자.

## 작업 1: 할 일을 달력에서 숨기기 (구현자 A, 먼저)

- 달력 그리드(`CalendarView`)·홈 주간 띠(`WeekStrip`)에서 `source === "task"` 항목을 그리지 않는다.
  - `src/components/calendar/sources.ts`: `SOURCES`/`DEFAULT_SOURCES`/`visibleItems`에서 task 제외 → '표시' 팝오버에도 '할 일' 체크 없음.
  - 저장된 `rb-calendar-sources`에 `task: true`가 남아 있어도 무시.
- 유지: 오른쪽 '오늘 할 일' 목록(할 일 그대로). '다음 일정'은 일정만 → task 제외.
- 유지 소스: 프로젝트 마감·세미나·분기 목표·회고·논문(기본 꺼짐)·Google.
- 관련 unit/e2e 셀렉터·기대값 맞춤.

## 작업 2: 구글 캘린더에 일정 추가

### 서버 (구현자 B)

- env (`.env.example`에 빈 키만): `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
  `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`(빈 값 = `primary`). `AUTH_GOOGLE_*`와 별개.
- `src/lib/calendar/google-write.ts`: `fetch` 직접 호출, 새 의존성 없음.
  - `googleWriteEnabled()` — 세 키가 다 있으면 true.
  - refresh_token → `https://oauth2.googleapis.com/token`로 access_token 교환(만료 전까지 메모리 캐시).
  - `insertEvent({ title, date, start?, end? })` → `POST https://www.googleapis.com/calendar/v3/calendars/{id}/events`.
    시간 없으면 종일(`date`/다음날 `date`), 있으면 `dateTime` + 앱 타임존.
  - 반환: 앱의 `CalendarItem`(source `google`) 형태. 에러는 `not_configured | auth | network | invalid` 구분.
- API: `POST /api/calendar/events` (로그인 필요, 입력 검증). 성공 201 + `{ item }`, 실패 시 `{ error: code }`.
  `GET /api/calendar` 응답(또는 기존 상태 필드)에 `googleWrite: boolean` 추가.
- 테스트: `fetch` 목으로 토큰 교환·종일/시간 일정·401·네트워크 실패·미설정.
- 문서: `docs/DEPLOY.md`에 "Google 캘린더 쓰기" 섹션 — Calendar API 사용 설정, OAuth 클라이언트 생성,
  `calendar.events` 동의, refresh_token 1회 발급(`scripts/google-calendar-token.mjs` 로컬 실행), env 입력.

### UI (구현자 A, 작업 1 끝난 뒤)

- 달력/오늘 패널에 '일정 추가' 버튼 → 공용 ui 폼: 제목, 날짜(선택일 기본), 시간(선택, 비우면 종일).
- 성공: 토스트 + 응답 `item`을 즉시 목록에 합침(ICS 캐시 지연 대비 낙관 반영, 같은 id면 중복 제거).
- 실패: 짧은 안내 토스트. `googleWrite`가 false면 버튼 비활성 + "설정 필요" 안내.
- e2e는 API 라우트 목(`page.route`)으로.

## 규칙

headless만, `loading.tsx` 금지, 문구 짧게, 공용 ui. 실제 Google 연동·토큰 발급 금지. `.env` 읽기 금지.
마이그레이션 없음 예상(생기면 적용 말고 보고). 1팀이 홈 입력칸 작업 중 → 병합 직전 develop 재병합.
