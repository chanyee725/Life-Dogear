# 달력·홈 7일 띠 시각 규칙 (단계 K)

> 근거: `docs/PLAN-CALENDAR.md`(승인), `docs/design/today.md`(마감 표기·행·키보드), `docs/design/graph.md` 1.2 종류 색·2.1 모양, `src/app/globals.css` 토큰.
> 대상: 구현자 B(`src/components/calendar/**`, `/tasks` 전환, 홈 미니 띠). 값은 그대로 옮겨 쓰면 되도록 클래스·숫자로 적었다.
> 원칙: **조용하게.** 새 CSS 변수 없음. 색은 **작은 모양 아이콘에만** 입히고(칸·글자는 무채색), 기간 띠만 기존 `tone-*-bg` 바탕을 쓴다. 그림자·그라데이션·애니메이션 장식 없음. 숫자는 모두 `tabular-nums`. 보조 글자에 `text-faint` 금지.

## 0. 핵심 결정 (먼저 읽기)

1. **월요일 시작**(ISO 주 — `/tasks` "이번 주" 탭과 같음). 주말 색 구분 없음.
2. 출처 구분은 **모양 아이콘 10×10(`ShapeIcon` 재사용) + 종류 색** — 색만으로 구분하지 않는다. 제목 글자는 색을 입히지 않는다.
3. **보이는 범위 전체를 덮는 기간 항목은 격자 위 "기간 줄"**, 범위 일부만 덮으면 **띠**. → 분기 목표는 거의 항상 기간 줄, 주간 회고는 월 보기에서 그 주의 띠.
4. 월 칸은 **고정 높이**, 항목 3줄까지. 넘치면 2개 + "+n".
5. 오늘 = 날짜 숫자만 accent 원. 칸 바탕은 그대로.
6. 390px 폭에서는 월 칸이 점 표시로 줄고, 고른 날의 목록이 격자 아래에 나온다(7절).

## 1. `/tasks` 보기 전환과 툴바

```
할 일                                              [목록 | 달력]
‹  ›  오늘   2026년 11월                       [월 | 주]   표시 ▾
분기 목표 ◯ 박사 논문 2장 완성 · ◯ 학회 투고        (기간 줄)
월    화    수    목    금    토    일
┌────┬────┬────┬────┬────┬────┬────┐
│ 26 │ 27 │ 28 │ 29 │ 30 │ 31 │  1 │ …
```

- **[목록 | 달력]**: `PageHeader` 오른쪽 액션 자리. 링크 2개짜리 세그먼트(graph.md 7절과 같은 작은 판 `h-7`, 버튼 `h-6 px-2.5 text-[13px]`), 현재 쪽 `aria-current="page"` + `bg-bg text-fg shadow-sm`, 아닌 쪽 `text-muted hover:text-fg`. 달력일 때는 `LinkTabs`(오늘·이번 주…)를 숨긴다.
- **툴바** `flex flex-wrap items-center gap-2 mt-6`:
  - `‹` `›` — `ghost icon` 28×28, `aria-label="이전 달"`/`"다음 달"`(주 보기면 "이전 주"/"다음 주").
  - "오늘" — `ghost sm`. 이미 오늘이 보이면 `disabled`가 아니라 그대로 둔다(누르면 아무 일 없음, 혼란 줄임).
  - 제목 `<h2 class="text-base font-semibold tracking-tight tabular-nums" aria-live="polite">` — 월 "2026년 11월", 주 "11월 2일 – 8일"(달이 걸치면 "10월 26일 – 11월 1일").
  - 오른쪽(`ml-auto`) **[월 | 주]** 세그먼트(`role="radiogroup" aria-label="범위"`, ←/→) + **표시 ▾** `ghost sm` 버튼.
- **표시 팝오버**(= 범례): `rounded-lg border border-border bg-bg shadow-overlay p-2 w-56`. 행 `h-8 flex items-center gap-2 px-2 rounded-md hover:bg-hover`: 체크박스 + 모양 아이콘 + 이름(`text-sm`). 순서·기본값은 2절 표. Google이 꺼져 있으면(`google: "off"`) 그 행은 `disabled` + 오른쪽 `text-xs text-muted` "설정 안 됨". 선택은 `localStorage` `rb-calendar-sources`(URL에 넣지 않음 — 보기 설정).

## 2. 출처별 색·모양

색 값은 graph.md 1.2 `KIND` 팔레트를 **그대로** 쓴다(`graph-theme.ts`의 `GRAPH_THEME_LIGHT/DARK`, `useGraphTheme()`로 다크 전환). 새 값은 Google 하나뿐이고 그것도 graph.md 1.3의 `neutral` 재사용.

| 출처 | 아이콘 (graph.md 2.1) | 라이트 | 다크 | 기본 |
|---|---|---|---|---|
| 할 일 (미완료) | □ 빈 정사각형 | `#357339` | `#7ec180` | 켬 |
| 할 일 (완료) | ■ 채운 정사각형, 알파 0.45 | 〃 | 〃 | 켬 |
| 프로젝트 마감 | ◆ 마름모 | `#6142aa` | `#977ee5` | 켬 |
| 세미나·발표 | ▲ 삼각형 | `#038586` | `#78d7d6` | 켬 |
| 분기 목표 (띠) | ◯ 원(안쪽 `goalSoft`) | `#cc3430` | `#f27166` | 켬 |
| 회고 (띠) | ▪ 작은 정사각형 | `#756960` | `#8f847c` | 켬 |
| 논문 (마지막 읽은 날) | ● 원 | `#348dcf` | `#75bffc` | 끔 |
| Google 일정 | **│ 세로 막대 2×10, 모서리 1px** (새 모양, 그래프에 없는 모양이라 앱 항목과 섞이지 않음) | `#71747c` | `#b4b7bf` | 설정돼 있으면 켬 |

- 아이콘 대비: 모두 바탕 3:1 이상(graph.md 1.2 계산값, Google 4.7 / 9.2).
- **Google 일정은 제목도 `text-muted`**(5.3 / 6.8) — 내 앱의 항목보다 한 단계 물러나 보이게. 시간이 있으면 제목 앞 `text-muted tabular-nums` "14:00"(24시간, 끝 시각은 넣지 않음). 종일은 시각 없음. 링크는 새 탭(`target="_blank" rel="noopener noreferrer"`), `aria-label`에 "Google 캘린더에서 열기" 덧붙임. 바깥 링크 아이콘은 넣지 않는다(칸이 좁음).
- 스크린 리더: 아이콘은 `aria-hidden`, 대신 항목 `aria-label`을 "할 일: 2장 초안, 마감 11월 5일" / "세미나: …" / "Google 일정: 14시, 연구실 회의"처럼 출처를 글자로 시작한다.

## 3. 월 보기

### 3.1 격자

- `<div role="grid" aria-label="2026년 11월">`, 요일 머리 `role="row"` + `role="columnheader"` 7개: `h-8 text-xs text-muted text-center`(월 화 수 목 금 토 일).
- 몸통: `grid grid-cols-7 auto-rows-fr`, 바깥 `border-l border-t border-border rounded-lg overflow-hidden`, 칸마다 `border-r border-b border-border`. 해당 월의 주만(5~6줄). 줄 수가 달마다 달라도 칸 높이는 같다.
- **칸** `role="gridcell"` `relative h-28 min-w-0 p-1 flex flex-col gap-0.5`(112px = 날짜 줄 24 + 항목 3줄 × 22 + 여유).
  - 날짜 숫자: 칸 왼쪽 위 `size-6 grid place-items-center text-xs tabular-nums text-fg`. 1일만 "11월 1일"로 달 이름을 붙인다(`w-auto px-1`).
  - 다른 달 날짜(앞뒤 채움): 칸 `bg-surface`, 숫자 `text-muted`. 항목은 그대로 보인다(같은 데이터).
  - 지난 날짜: 칸 모양은 같고 항목 규칙만 4절.
- **오늘**: 숫자를 `rounded-full bg-accent text-accent-fg font-semibold`(5.5 / 6.7)로. 칸 바탕·테두리는 바꾸지 않는다. 칸에 `aria-current="date"`.

### 3.2 칸 안 항목 (한 줄)

```
□ 2장 초안            ← 할 일
◆ 투고 마감           ← 프로젝트
│ 14:00 연구실 회의   ← Google (muted)
+2                    ← 넘침
```

- 항목 `<a>`/`<button>` `flex h-5 items-center gap-1.5 rounded-[4px] px-1 text-xs hover:bg-hover min-w-0`, 아이콘 10px `shrink-0`, 제목 `truncate`. 바탕 채움·색 테두리 없음.
- 칸 안 순서: ① 프로젝트 마감 ② 세미나 ③ 미완료 할 일(지남 포함) ④ Google(종일 → 시간 순) ⑤ 논문 ⑥ 완료 할 일. 같은 묶음 안은 제목 가나다.
- **넘침**: 띠·항목 합쳐 3줄을 넘으면 앞 2줄 + `+n` 버튼(`h-5 px-1 text-xs text-muted hover:text-fg tabular-nums`, `aria-label="11월 5일 항목 4개 더 보기"`). 누르면 **그날 팝오버**: 칸에 붙여 `rounded-lg border border-border bg-bg shadow-overlay p-2 w-64 max-h-80 overflow-auto`, 머리 `text-[13px] font-semibold` "11월 5일 목요일", 아래 같은 항목 줄을 전부(`h-6 text-[13px]`), 맨 아래 "＋ 할 일 추가"(6절). `Esc`·바깥 클릭으로 닫고 포커스는 `+n`으로 돌아간다.

### 3.3 기간 줄과 띠

**기간 줄**(보이는 범위 1일~말일 전체를 덮는 항목: 분기 목표, 그 달 월간 회고): 툴바와 격자 사이 `flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 mb-2 text-[13px]`. 각 항목 = 아이콘 + 제목 링크(`text-fg hover:underline truncate max-w-60`). 앞에 `text-muted` 라벨 없음 — 아이콘이 말한다. 분기 목표가 4개를 넘으면 3개 + "+n"(목표 화면 링크). 비면 줄 자체를 그리지 않는다.

**띠**(범위 일부만 덮는 기간: 주간 회고, 주 보기에서 달이 걸칠 때의 월간 회고, 분기 경계 주의 분기 목표):

- 주 줄마다 날짜 숫자 바로 아래 **띠 칸**(최대 2줄)을 두고, 칸을 가로질러 `absolute`로 그린다(주 줄 컨테이너 기준 `left = 시작열/7`, `width = 열 수/7`, 좌우 2px 안쪽 여백).
- 띠 `h-5 flex items-center gap-1.5 px-1.5 text-xs text-fg truncate rounded-[4px]`:
  - 회고 `bg-tone-gray-bg`, 분기 목표 `bg-tone-red-bg`. 글자 대비 15.7 / 15.4(다크 12.8 / 13.4).
  - **시작하는 쪽에만** 아이콘 + 왼쪽 `border-l-2`(종류 색). 이전 주에서 이어지면 `rounded-l-none`, 다음 주로 이어지면 `rounded-r-none`. 이어지는 주에서도 제목은 다시 쓴다(줄마다 읽히게).
- 띠가 차지한 줄만큼 그 주 칸의 항목 자리가 준다(3줄 예산을 같이 씀). 띠가 3개 이상 겹치면 2개 + 남은 띠는 해당 칸 `+n`에 포함.
- 띠 전체가 하나의 링크(회고·목표 화면). 포커스 링은 띠 둘레.

## 4. 끝냈거나 지난 항목

| 상태 | 아이콘 | 제목 | 스크린 리더 |
|---|---|---|---|
| 할 일 완료 | ■ 알파 0.45 | `text-muted line-through decoration-border-strong` | "완료" 덧붙임 |
| 할 일 미완료 + 마감 지남 | □ 그대로 | `text-tone-red-fg`(6.9 / 8.3) | "마감 지남" 덧붙임 |
| 할 일 미완료 + 오늘 | □ | `text-fg` (오늘 칸이 이미 말함 — amber 쓰지 않음) | — |
| 지난 날짜의 세미나·프로젝트·Google | 그대로 | `text-muted` | — |

- 지남은 색 + 위치(지난 칸) + 글자(aria) 세 가지로 전달(1.4.1). 칸 안에 "지남" 글자를 따로 넣지 않는다(좁음).
- 완료 할 일도 끌 수 없다(5절).

## 5. 끌기·키보드·포커스

### 5.1 마우스 끌기 (할 일 미완료만, `taskId` 있는 항목)

- 할 일 항목은 `hover:cursor-grab`. 4px 이상 움직여야 끌기 시작(그냥 누르면 할 일 화면으로 이동).
- 끄는 동안: 원래 항목 `opacity-40`, 따라오는 복제본 `bg-bg shadow-overlay rounded-[4px] px-1 h-5`, 놓일 칸 `bg-accent-soft` + `outline outline-2 -outline-offset-2 outline-accent`. 다른 칸 강조 없음.
- 놓으면 즉시 새 칸으로 옮기고(낙관적) 저장. 실패하면 원래 칸으로 되돌리고 툴바 아래 `text-[13px] text-danger` "마감일을 바꾸지 못했습니다." 5초. 성공은 화면 글자 없이 `aria-live="polite"` "2장 초안, 마감 11월 7일로 옮김".
- `Esc`로 끌기 취소. reduced motion이면 되돌림 애니메이션 없음(애초에 장식 애니메이션 없음).
- 터치(390px 포함)에서는 끌기 없음 → 메뉴(5.3).

### 5.2 키보드 (격자는 하나의 Tab 정지점)

| 위치 | 키 | 동작 |
|---|---|---|
| 격자 | `Tab` | 격자로 들어오면 **오늘 칸**(없으면 1일)에 포커스. 칸 사이는 roving `tabindex` |
| 칸 | `←` `→` / `↑` `↓` | 하루 / 한 주 이동. 범위 밖으로 나가면 달(주)을 넘기고 따라감 |
| 칸 | `Home` `End` | 그 주 월요일 / 일요일 |
| 칸 | `PageUp` `PageDown` | 이전 / 다음 달(주) 같은 날 |
| 칸 | `Enter` | 항목이 있으면 첫 항목으로 들어감, 없으면 빠른 추가(6절) |
| 항목 | `↑` `↓` | 칸 안 항목 이동 (`+n`도 한 항목) |
| 항목 | `Enter` | 열기 |
| 항목 | `Esc` | 칸으로 돌아감 |
| 할 일 항목 | `[` / `]` | 마감 하루 앞 / 뒤. 포커스는 옮겨진 항목을 따라감, 결과 `aria-live` |
| 할 일 항목 | `Shift+F10` / 메뉴 키 | 항목 메뉴(5.3) |

- 칸 `aria-label`: "11월 5일 목요일, 항목 3개"(오늘이면 "오늘, 11월 4일 수요일, …").
- 키 설명은 격자 `aria-describedby`로 숨김 도움말 한 줄: "화살표로 날짜 이동, Enter로 항목 보기, 할 일은 [ ] 로 하루씩 옮깁니다."
- `[`/`]`는 할 일 항목에 포커스가 있을 때만(입력 중·다른 곳에서는 무시). 전역 `N`·`G`·`C`·`/`와 겹치지 않음.

### 5.3 항목 메뉴

할 일 항목 오른쪽 클릭·`Shift+F10`·(터치) 길게 누르기 500ms: 기존 메뉴 모양(today.md 2.1 더 보기 메뉴). 항목: 열기 / 날짜 옮기기… (today.md 2.1 마감일 팝오버 재사용: 오늘·내일·다음 주 월요일 + `DateField`) / 완료로 표시.

### 5.4 포커스 모양

- 전역 `:focus-visible`(accent 2px)을 그대로 쓰되, 칸·항목·띠는 **안쪽으로**(`focus-visible:outline-offset-[-2px]`) — 격자 선·`overflow-hidden`에 잘리지 않게.
- 오늘 칸에 포커스: accent 원 숫자 + accent 테두리가 겹치지만 모양이 달라(원 vs 칸 테두리) 구분된다.

## 6. 빠른 추가 (그날 마감 할 일, 소속 없음)

- 칸에 hover·포커스일 때만 오른쪽 위 `ghost icon` 20×20 "＋"(`absolute right-1 top-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`), `aria-label="11월 7일 마감 할 일 추가"`. **항목이 없는 칸**은 빈 부분을 눌러도 같은 동작.
- 열리는 것: 칸에 붙은 팝오버 `rounded-lg border border-border bg-bg shadow-overlay p-3 w-72`.
  - 머리 `text-[13px] text-muted` "11월 7일 토요일 마감".
  - 입력 `controlClass` `h-9`, 자리표시 "할 일". `Enter` 저장 후 **입력 유지·비움**(연달아), IME 조합 중 Enter 무시, `Esc` 닫기 → 포커스는 칸으로.
  - 300자·실패 문구는 today.md 2.2와 같음.
- 새 항목은 칸에 바로 나타난다(낙관적). 3줄을 넘으면 "+n"이 늘어난다.

## 7. 주 보기

- 같은 툴바, 기간 줄(이번 주 전체를 덮는 분기 목표·주간 회고)은 3.3과 같다.
- 머리: 7열 `h-12`, 요일 `text-xs text-muted` + 날짜 `text-base tabular-nums`(오늘은 3.1의 accent 원, `size-7`).
- 띠: 머리 아래 띠 칸(달이 걸친 월간 회고 등), 3.3 규칙.
- 몸통: 7열 `min-h-80`, 칸마다 항목을 **모두** 보인다(넘침 없음, 칸이 길어짐). 항목 줄 `h-6 text-[13px]`, 아이콘 10px. 시간 격자(시간대 칸)는 만들지 않는다 — 시간 있는 Google 일정은 "14:00" 접두로 순서만.
- 칸 맨 아래 hover 때 "＋ 할 일 추가" `text-xs text-muted`(6절과 같은 팝오버).
- 키보드는 5.2와 같다. 단 주 보기는 한 줄이라 칸에서 `↑` `↓`는 아무 일도 하지 않는다(칸 이동은 ←/→, 항목 안에서는 5.2대로 ↑/↓).

## 8. 좁은 폭 (`< 640px`, 390px 기준)

**월 보기 — 점 칸**:
- 칸 `h-14 p-0.5 flex flex-col items-center gap-1`: 날짜 숫자 `size-6`(오늘 accent 원) + 아래 점 줄.
- 점 줄: 그날 출처 중 앞 순서(3.2) **최대 3개 출처**의 4×4 점(`rounded-full`, 출처 색; 완료만 있는 할 일은 빈 점 1px 테두리). 4개 이상이면 3개만. 띠는 칸 아래 2px 높이 막대(`bg-tone-*-bg`가 너무 옅으니 **종류 색 알파 0.5**)로만.
- 칸을 누르면 그 날을 **선택**(`aria-selected="true"`, 숫자 `ring-1 ring-border-strong`), 격자 아래 `mt-4`에 **그날 목록**: 머리 `text-[13px] font-semibold` "11월 5일 목요일" + 항목 줄 `h-10 text-sm`(터치 44px 가까이), 맨 아래 "＋ 할 일 추가". 처음엔 오늘이 선택.
- 툴바 줄바꿈: 1줄 `‹ 제목 ›` + 오늘, 2줄 [월 | 주] + 표시. 기간 줄은 세로로 쌓기(`flex-col items-start`).

**주 보기 — 세로 목록**: 7열 대신 날짜 묶음 7개를 위아래로(`flex flex-col gap-4`). 묶음 머리 `text-[13px] font-semibold` "11월 5일 목" + 오늘이면 옆에 `text-xs text-accent` "오늘". 빈 날은 머리 + `text-xs text-muted` "없음" 한 줄(칸 높이를 지키지 않음).

## 9. 홈 7일 미니 띠

- 위치: today.md 4.1의 **1 빠른 입력 묶음 다음, 2 "오늘" 섹션 앞**. 섹션 제목 없음(날짜 줄과 "오늘" 사이의 조용한 줄). 오른쪽 링크도 없음 — 띠 자체가 링크.
- `<nav aria-label="이번 주"><ol class="grid grid-cols-7 gap-1">`, 각 날 `<a>` `flex h-16 flex-col items-center justify-center gap-1 rounded-md hover:bg-hover`:
  - 요일 `text-[11px] text-muted`, 날짜 `text-sm tabular-nums text-fg`, 점 줄(8절과 같은 4×4 점 최대 3개, 0개면 높이만 유지 `h-1`).
  - **오늘**: `bg-accent-soft`, 날짜 `font-semibold`, `aria-current="date"`. 대비: `text-muted` on accent-soft 4.65 / 5.6, `text-fg` 15.6 / 12.8.
  - 지난 날: 날짜 `text-muted`.
- **점·개수에는 하루짜리 항목만 센다**(할 일·프로젝트 마감·세미나·논문·Google). 분기 목표·회고 같은 기간 항목은 뺀다 — 넣으면 매일 점이 찍혀 띠가 아무것도 말하지 않는다(8절 좁은 월 칸 점과 같은 규칙).
- 개수는 글자로 보이지 않는다(점만, 조용하게). 대신 `aria-label="11월 5일 목요일, 항목 3개"`. 0개면 "항목 없음".
- 이동: `/tasks?view=calendar&range=week&date=YYYY-MM-DD`.
- 출처 선택(표시 팝오버)을 따른다. 데이터가 하나도 없어도 띠는 보인다(이번 주 길잡이).

## 10. 빈 상태·실패 문구

모두 `text-[13px] text-muted` 한 줄, 기간 줄 자리(툴바 아래)에. `EmptyState` 카드는 쓰지 않는다 — 빈 격자가 이미 화면이다.

| 경우 | 문구 |
|---|---|
| 이 달(주)에 항목 없음 | 이번 달에 표시할 날짜가 없습니다. 날짜를 눌러 할 일을 추가할 수 있습니다. (주 보기는 "이번 주에") |
| 출처를 모두 끔 | 표시할 항목을 고르지 않았습니다. **표시**에서 켤 수 있습니다. ("표시"는 팝오버를 여는 `underline` 버튼) |
| Google 실패 (`google: "error"`) | 캘린더를 불러오지 못했습니다. **다시 시도** — 여러 주소 중 일부면 "두 번째 캘린더를 불러오지 못했습니다." (주소·오류 내용은 절대 보이지 않음) |
| 앱 데이터 실패 | 달력을 불러오지 못했습니다. **다시 시도** (`text-danger`가 아니라 muted — 조용하게, `role="status"`) |
| 마감 변경 실패 | 마감일을 바꾸지 못했습니다. (`text-danger`, 5초, `aria-live="polite"`) |

- Google 실패여도 앱 항목은 그대로 보인다. 실패 문구와 빈 문구가 같이 나오면 실패 문구 먼저, 두 줄.
- 불러오는 중: 격자는 바로 그리고 항목만 나중에. 스피너는 툴바 제목 옆 `Spinner` 12px 하나(`aria-label="불러오는 중"`). 뼈대(스켈레톤) 없음. `src/app/loading.tsx` 금지(계획).

## 11. 대비 점검 (계산값, WCAG 2)

| 쓰임 | 라이트 | 다크 |
|---|---|---|
| 항목 제목 `text-fg` / bg | 17.9 | 15.9 |
| Google·지난 항목 `text-muted` / bg | 5.3 | 6.8 |
| `text-muted` / 다른 달 칸 `bg-surface` | 5.1 | 6.5 |
| `text-muted` / `bg-hover` | 4.6 | 5.6 |
| 지남 `text-tone-red-fg` / bg | 6.9 | 8.3 |
| 오늘 숫자 `text-accent-fg` / `bg-accent` | 5.5 | 6.7 |
| 띠 `text-fg` / `tone-gray-bg` · `tone-red-bg` | 15.7 · 15.4 | 12.8 · 13.4 |
| 띠 왼쪽 선 회고 / `tone-gray-bg`, 목표 / `tone-red-bg` (비글자 3:1) | 4.7 · 4.5 | 4.1 · 5.5 |
| 미니 띠 오늘 `text-muted` / `accent-soft` | 4.65 | 5.6 |
| 출처 아이콘 / bg (비글자 3:1) | ≥ 3.2 | ≥ 5.0 |
| 포커스 outline accent / bg | 5.5 | 6.7 |

- 완료 할 일 아이콘(알파 0.45)과 격자 선(`border`)은 장식·비활성으로 3:1 예외 — 완료는 글자 취소선과 aria로도 전달.

## 12. 구현자 자가 점검

- [ ] 색만으로 구분하는 곳이 없다(아이콘 모양·aria 출처 글자).
- [ ] 격자 하나가 Tab 정지점 하나, 화살표·Home/End·PageUp/Down 동작.
- [ ] 끌기와 같은 일을 키보드(`[` `]`, 메뉴)와 터치(메뉴)로 할 수 있다.
- [ ] 팝오버는 `Esc`로 닫히고 연 자리로 포커스가 돌아간다.
- [ ] 다크에서 아이콘 색이 다크 값으로 바뀐다(`useGraphTheme`).
- [ ] 390px에서 가로 스크롤이 없다(월 점 칸 + 그날 목록, 주 세로 목록).
- [ ] Google 주소·오류 원문이 화면·aria·title 어디에도 없다.

## 13. 5:5 레이아웃 — 2주 달력 + 오늘 패널 (사용자 요청, 1·3·7절보다 우선)

```
‹ › 오늘  11월 2일 – 15일          [2주 | 월]  표시 ▾
┌──────── 2주 달력 (1fr) ───────┐  ┌──── 오늘 패널 (1fr) ────┐
│ 월 화 수 목 금 토 일            │  │ 오늘                [오늘로]│
│ 2  3  4● 5  6  7  8           │  │ 11월 4일 수요일          │
│ 9 10 11 12 13 14 15           │  │ 다음 일정                │
└───────────────────────────────┘  │ 오늘 ─ 14:00 │ 연구실 회의 │
                                   │ 내일 ─ □ 2장 초안 …       │
```

**범위**: 기본 **2주**(이번 주 월요일부터 14일). 툴바 세그먼트는 **[2주 | 월]**(`aria-label="범위"`), 7절 주 보기는 2주로 대체된다. `‹ ›`는 2주 단위("이전 2주"/"다음 2주"), 제목 "11월 2일 – 15일"(달 걸치면 "10월 26일 – 11월 8일"). 월 보기는 3절 그대로 왼쪽 열 안에서.

### 13.1 두 열

- 달력 화면만 `Page`를 `max-w-7xl`로 넓힌다(5xl이면 칸이 48~65px라 제목이 거의 안 보임).
- `lg` 이상: 툴바는 두 열 위 전체 폭, 아래 `grid grid-cols-2 gap-8 items-start mt-4`. 두 열 모두 `min-w-0`. 오늘 패널은 `lg:sticky lg:top-6`(긴 목록에서 달력과 같이 보이게).
- `lg` 미만: `flex flex-col gap-6`, **오늘 패널이 위**(`order-first`), 달력이 아래.
- DOM 순서는 툴바 → 달력 → 패널(원인→결과). `lg` 미만은 화면 순서와 Tab 순서가 어긋나지만, 패널 안 목록은 날짜를 고른 결과이므로 받아들인다.

### 13.2 2주 칸

- 격자 3.1 그대로, 2줄. 칸 `h-36`(144px = 날짜 24 + 항목 5줄 × 22 + 여유). **5줄까지**, 넘으면 4줄 + `+n`(3.2 팝오버). 띠·기간 줄 규칙은 3.3 그대로(띠도 5줄 예산을 같이 씀).
- 칸이 좁으면(≈ 80px) 제목은 `truncate`, 항목에 `title` 속성으로 전체 제목. 시각 접두 "14:00"은 칸에서는 빼고 패널에서만 보인다(칸 폭 절약).
- **선택 날짜**: 숫자 `ring-1 ring-border-strong`(8절과 같음) + 칸 `aria-selected="true"`. 오늘 accent 원과 겹치면 둘 다(원 + 바깥 링). 칸 바탕은 바꾸지 않는다.
- 칸 클릭 = 선택(항목 클릭은 기존대로 열기). 키보드 칸 이동(5.2)이 곧 선택 — 포커스한 칸이 선택된다. `Enter` 동작은 5.2 그대로.

### 13.3 오늘 패널

- `<section aria-labelledby="day-panel-title" class="flex flex-col">`, 테두리·카드 없음(왼쪽 열과 같은 평면).
- 머리 `flex items-start justify-between`:
  - 위 작은 줄 `text-[13px] text-muted`: "오늘" / "내일" / 그 외는 비움.
  - 큰 날짜 `<h2 id="day-panel-title" class="text-2xl font-semibold tracking-tight tabular-nums">` "11월 4일 수요일" (`aria-live="polite"` — 날짜를 바꾸면 읽힘).
  - 오른쪽 **"오늘로"** `ghost sm` — 선택이 오늘이 아닐 때만 보인다(오늘이면 숨김). 누르면 선택=오늘, 달력 범위도 오늘이 든 2주로, 포커스는 버튼이 사라지므로 **오늘 칸**으로.
- 소제목 `mt-6 h-8 text-[13px] font-semibold text-muted` "다음 일정" + `text-xs tabular-nums` 개수.
- **목록**: 선택 날짜 0시부터 시간순 **최대 10개**(하루짜리 항목만 — 9절 규칙, 기간 항목 제외). 날짜 묶음:
  - 묶음 머리 `mt-4 first:mt-0 h-7 text-xs font-medium text-muted` — "오늘", "내일", 그 외 "11월 6일(금)". 선택 날짜가 오늘이 아니면 첫 묶음은 "11월 6일(금)" 형식.
  - **행** `flex h-9 items-center gap-2.5 rounded-md px-2 -mx-2 hover:bg-hover text-sm`:
    1. 출처 아이콘 10px(2절) `shrink-0`
    2. 시각 `w-11 shrink-0 text-[13px] text-muted tabular-nums` "14:00" / 종일·시각 없음은 "종일"(할 일·마감은 시각 없음 → "종일" 대신 **빈 칸 유지**로 제목 열을 맞춤)
    3. 제목 `min-w-0 flex-1 truncate text-fg`(Google은 `text-muted`, 완료·지남은 4절)
    4. 출처 `shrink-0 text-xs text-muted` — 할 일은 소속 프로젝트명, 프로젝트 마감 "마감", 세미나 "세미나", Google "Google". `max-w-28 truncate`.
  - 한 묶음 안 순서: 시각 있는 것 시간순 → 시각 없는 것(3.2 묶음 순서).
  - 10개를 넘으면 마지막에 `text-xs text-muted` "이후 n개는 달력에서" 한 줄(링크 없음).
- 빈 상태(`role="status"`, `text-[13px] text-muted` 한 줄, 카드 없음): "11월 4일 이후 예정된 일정이 없습니다." + 아래 `ghost sm` "＋ 할 일 추가"(6절 팝오버, 그날 마감).
- 대비: 모두 11절 값 재사용(`text-muted` / bg 5.3 · 6.8). 새 색 없음.

### 13.4 포커스 흐름

툴바(‹ › 오늘 · 범위 · 표시) → 격자(Tab 1번, 화살표로 날짜=선택) → 패널 "오늘로"(보일 때) → 목록 행 순서대로(각 행이 하나의 링크) → 빈 상태면 "＋ 할 일 추가". 선택을 바꿔도 포커스는 격자에 남는다(패널은 `aria-live` 제목만 읽힘).

### 13.5 390px

- 패널 위: 큰 날짜 `text-xl`, 행 `h-11`(터치 44px), 출처 열은 숨기고(`max-sm:hidden`) aria-label에만 둔다.
- 2주 달력은 8절 점 칸(`h-14`, 점 최대 3개) 2줄 — 그날 목록은 따로 그리지 않는다(위 패널이 그 역할). 8절의 "격자 아래 그날 목록"은 2주 보기에선 쓰지 않는다(월 보기 390px는 8절 그대로).
- 가로 스크롤 없음.
