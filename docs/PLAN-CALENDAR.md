# 계획: 달력 + Google 캘린더 읽기 (단계 K)

> **승인됨 (2026-11-04)**. 새 입력 장소를 늘리지 않는다(별도 "일정" 엔티티 없음), 사이드바 메뉴도 늘리지 않는다. 마이그레이션은 필요 없을 것으로 본다. `src/app/loading.tsx` 금지.

## 1. 달력 화면

- `/tasks`에 `[목록 | 달력]` 전환(`?view=calendar`, 월·주 보기 `?range=month|week`, 기준 날짜 `?date=YYYY-MM-DD`).
- 날짜 칸에 기존 날짜를 모아 표시(읽기 계산, 저장 없음):

| 출처 | 날짜 | 기본 |
|---|---|---|
| 할 일 | 마감일 | 켬 |
| 프로젝트 | 마감일 | 켬 |
| 세미나·발표 | 날짜 | 켬 |
| 회고 | 주간·월간 기간(띠) | 켬 |
| 분기 목표 | 분기 기간(띠) | 켬 |
| 논문 | 마지막으로 읽은 날 | 끔 |
| Google 캘린더 | 일정(종일·시간) | 설정돼 있으면 켬 |

- 색은 그래프 종류 색(`docs/design/graph.md` 1.2) 재사용, Google 캘린더는 회색 계열. 모양·글자로도 구분.
- 항목을 누르면 해당 화면으로(Google 일정은 Google 캘린더 링크).
- 할 일을 다른 날짜로 끌어 놓으면 마감일 변경(키보드 대안: 선택 후 `[`/`]`로 하루씩, 또는 메뉴 "날짜 옮기기"). 빈 날짜를 누르면 그날 마감 할 일 빠른 추가(소속 없음).
- 홈 오늘 화면: 이번 주 7일 미니 띠(오늘 강조, 날짜별 점·개수), 누르면 달력 주 보기로.

## 2. Google 캘린더 읽기 전용 (비공개 iCal 주소)

- `GOOGLE_CALENDAR_ICS_URLS`(쉼표로 여러 개). `.env.example`에는 빈 키만. **비밀번호급** — 로그·에러·응답·클라이언트 번들·테스트·문서에 실제 값이 나오면 안 된다(문서 예시는 자리표시).
- 서버에서 가져와 파싱: 반복(RRULE·EXDATE·RECURRENCE-ID), 종일/시간 일정, 시간대(`TZID`, 기본 Asia/Seoul). 범위는 요청한 달·주만 펼친다(펼칠 개수 상한).
- 파서: 가벼운 순수 JS 하나까지(`ical.js` 권장 — Mozilla, 의존성 없음) 또는 안전하면 직접 파싱.
- 캐시: 주소별 메모리 5~10분(실패도 짧게 캐시해 반복 요청 방지). 가져오기 시간 제한(예: 8초), 응답 크기 상한.
- 실패하면 조용히 "캘린더를 불러오지 못했습니다" 한 줄. 어떤 주소가 실패했는지도 값 없이(첫 번째·두 번째 정도로만).
- 클라이언트에는 일정의 제목·시간·종일 여부·Google 링크만 보낸다(주소는 보내지 않음).
- 문서: `docs/DEPLOY.md`에 "Google 캘린더 설정 → 캘린더 통합 → 비공개 주소(iCal 형식) 복사 → env에 넣기".
- 테스트는 픽스처 ICS로(외부 요청 없음).

## 3. 담당

| 담당 | 범위 |
|---|---|
| 구현자 A | 달력 데이터 모음 `src/lib/calendar/**`(출처별 날짜 → `CalendarItem` 목록, 범위 질의, 쿼리 수 고정), ICS 가져오기·파싱·캐시 `src/lib/calendar/ics/**`, 필요하면 `src/app/api/calendar/**`, `package.json`(파서), `.env.example`, `docs/DEPLOY.md` 캘린더 절 |
| 구현자 B | 달력 화면 `src/components/calendar/**`, `/tasks` 보기 전환(`src/app/tasks/**`), 끌어 놓기·키보드로 마감일 변경·빈 날짜 빠른 추가(기존 할 일 액션 재사용, 필요하면 `src/app/_actions/tasks.ts`에 마감일만 바꾸는 액션), 홈 미니 띠(`src/components/dashboard/**`, `src/app/page.tsx`) |
| 디자이너 | `docs/design/calendar.md`(월·주 격자, 띠, 색·모양, 오늘 강조, 넘칠 때 "+n", 미니 띠, 끌기·키보드, 빈 상태·실패 문구, 다크), 이후 화면 검토(headless) |
| 리뷰어 | 전체. ICS 주소 노출(로그·에러·응답·번들) 최우선, 외부 요청 시간·크기 제한, 반복 일정 펼침 상한, 시간대, 쿼리 수, 끌어 놓기 실패 롤백 |

### 인터페이스 (B가 A를 기다리지 않게)

```ts
// @/lib/calendar
type CalendarSource = "task" | "project" | "seminar" | "review" | "goal" | "paper" | "google"
type CalendarItem = {
  id: string            // "<source>:<id>" (google은 "google:<uid>:<start>")
  source: CalendarSource
  title: string
  start: string         // YYYY-MM-DD (종일) 또는 ISO 시각
  end?: string          // 띠·기간이면 마지막 날(포함)
  allDay: boolean
  href?: string         // 앱 화면 또는 Google 링크
  done?: boolean        // 할 일
  taskId?: string       // 끌어 놓기용
}
getCalendar(range: { from: string; to: string }, opts?: { papers?: boolean }): Promise<{ items: CalendarItem[]; google: "ok" | "off" | "error" }>
```
