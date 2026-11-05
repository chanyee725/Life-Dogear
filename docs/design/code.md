# 코드 블록·노트 템플릿 디자인 (단계 P)

> 근거: `docs/PLAN-POLISH.md` 2·3절, `src/app/globals.css`(`.rb-prose pre`, `--rb-*` 토큰), `docs/design/graph.md`(quiet 규칙).
> 원칙: 색은 은은하게, 장식(그림자·그라데이션·애니메이션) 없음. 의미는 색만으로 전달하지 않는다(코드는 글자 자체가 내용).
> 대비는 WCAG 2 상대 휘도로 계산했다. 이 문서는 값만 정한다 — 코드는 구현자가 옮긴다.

## 0. 인라인 코드 (백틱 `` `c` ``)

`.rb-prose code`(블록 안 `pre code`는 제외 — 1.1의 규칙만 따른다).

- 글자 `--font-mono` **0.86em**, 색 `--rb-code-inline` — 라이트 `#b3402f`(바탕 `#f7f6f3` 위 5.3:1), 다크 `#e8897d`(바탕 `#1f1f1f` 위 6.5:1). 붉은 계열이되 채도를 낮춰 모노 팔레트와 어울리게 했다.
- 바탕 `--rb-code-bg`, 테두리 `1px --rb-code-border`, 모서리 4px, 여백 `0.08em 0.35em`.
- 긴 경로는 `overflow-wrap: anywhere`로 줄을 넘기고, 줄이 바뀌어도 테두리가 양쪽에 붙게 `box-decoration-break: clone`.
- 링크 안 인라인 코드는 링크 색을 따른다(`a code { color: inherit }`) — 눌리는 글자임이 보이게.

## 1. 문법 색 토큰

### 1.1 바탕과 틀

`.rb-prose pre`: 배경 `--rb-code-bg`, 테두리 `1px --rb-code-border`, 모서리 8px, 안쪽 여백 `0.8em 1em`, 글자 `--font-mono` 0.86em, 줄 간격 1.6, `tab-size: 2`. 코드 블록 노드뷰(`.rb-code`) 안에서는 틀(배경·테두리·모서리)을 래퍼가 갖고 `pre`는 틀 없이 여백 `0.75em 1em 0.85em`(폭 < 640px에서 좌우 0.85em). 문법 색은 이 바탕(라이트 `#f7f6f3` / 다크 `#1f1f1f`; 테두리 `--rb-code-border` 라이트 `#eceae5` / 다크 `#2b2b2b` — 페이지 바탕 `#ffffff` / `#191919` 위에서 아주 살짝만 구분된다) 위에서 **전부 4.5:1 이상**이다.

### 1.2 토큰 (globals.css의 `:root` / `.dark` 블록에 추가)

| 변수 | 쓰임 | 라이트 | 대비 | 다크 | 대비 |
|---|---|---|---|---|---|
| `--rb-code-bg` | 코드 바탕 | `#f7f6f3` | — | `#1f1f1f` | — |
| `--rb-code-border` | 코드 테두리 | `#eceae5` | — | `#2b2b2b` | — |
| `--rb-code-fg` | 기본 글자 (= `--rb-fg` 값) | `#2f2e2a` | 12.6 | `#e6e5e3` | 13.1 |
| `--rb-code-comment` | 주석 | `#666670` | 5.3 | `#9d9da6` | 6.1 |
| `--rb-code-keyword` | 키워드·내장 | `#8a3a9e` | 6.1 | `#c9a0f0` | 7.7 |
| `--rb-code-string` | 문자열·정규식 | `#1f6b3c` | 6.0 | `#8fd0a0` | 9.2 |
| `--rb-code-number` | 숫자·리터럴(true/null) | `#a34a00` | 5.5 | `#f0a878` | 8.3 |
| `--rb-code-function` | 함수 이름·제목(title) | `#2a52b0` | 6.6 | `#8db4f2` | 7.8 |
| `--rb-code-attr` | 속성·태그 이름 | `#0e6b72` | 5.8 | `#7fd3d0` | 9.5 |
| `--rb-code-variable` | 변수·매개변수·템플릿 변수 | `#9b3a32` | 6.4 | `#f09a90` | 7.6 |

- 색상각은 기존 tone과 겹치게 골랐다(violet·green·amber·blue·teal·red). 새 계열을 만들지 않는다.
- 주석은 `font-style: italic` 없이 **색만** 흐리게(5.2:1 — 흐려도 읽힌다). 굵기 변화 없음.
- 선택 영역·줄 번호·줄 강조 없음(이번 단계 범위 밖).

### 1.3 hljs 클래스 매핑 (lowlight 출력, `.rb-prose pre code` 안)

| 클래스 | 변수 |
|---|---|
| `.hljs` (기본) | `--rb-code-fg` |
| `.hljs-comment`, `.hljs-quote`, `.hljs-meta` | `--rb-code-comment` |
| `.hljs-keyword`, `.hljs-built_in`, `.hljs-selector-tag`, `.hljs-type` | `--rb-code-keyword` |
| `.hljs-string`, `.hljs-regexp`, `.hljs-symbol`, `.hljs-addition` | `--rb-code-string` |
| `.hljs-number`, `.hljs-literal`, `.hljs-bullet` | `--rb-code-number` |
| `.hljs-title`, `.hljs-title.function_`, `.hljs-section` | `--rb-code-function` |
| `.hljs-attr`, `.hljs-attribute`, `.hljs-name`, `.hljs-tag`, `.hljs-selector-class`, `.hljs-selector-id` | `--rb-code-attr` |
| `.hljs-variable`, `.hljs-params`, `.hljs-template-variable`, `.hljs-deletion` | `--rb-code-variable` |
| 그 밖의 `.hljs-*` | 상속(기본 글자) |

`.hljs-emphasis`·`.hljs-strong`은 굵기·기울임을 쓰지 않고 상속한다. 에디터(`.ProseMirror pre`)와 읽기 화면(`.rb-prose pre`)이 같은 규칙을 쓰도록 선택자를 `.rb-prose .hljs-*, .ProseMirror .hljs-*`로 묶는다.

## 2. 언어 표시와 복사 버튼

구조: `<div.rb-code[data-language]> <div.rb-code-bar>[복사][ts]</div> <pre><code>…</code></pre> </div>`. 래퍼가 틀(`--rb-code-bg`, `1px --rb-border`, 8px, `overflow: hidden`)을 갖는다.

- **언어가 있을 때 — 위 띠**: 바 높이 2rem, 바탕 `--rb-surface`, 아래 경계 `1px --rb-border`, 좌우 여백 `0.875rem / 0.375rem`(폭 < 640px 왼쪽 0.75rem). 언어는 **왼쪽**, 복사 버튼은 **오른쪽**(DOM 순서는 그대로, `order`·`margin-left: auto`로 배치).
- **언어가 없을 때 — 떠 있는 버튼**: 띠 없이 바가 오른쪽 위(`top: 4px`)에 뜬다. 버튼 바탕은 `--rb-code-bg`(가로 스크롤된 글자 위에서도 읽힘), `pre`는 `padding-right: 4.75rem`으로 첫 줄과 겹치지 않는다.
- **언어 표시**: `text-[11px]`, `--font-mono`, 색 `--rb-muted`(surface 위 라이트 5.1:1 / 다크 6.5:1), 소문자 그대로(`ts`, `bash`). 클릭 불가, `aria-hidden="true"`(언어는 `data-language`로 전달).
- **복사 버튼**: 바 오른쪽 끝. 글자 버튼, `h-6 px-2 text-[12px]`, 배경 없음(`transparent`), 테두리 없음, 색 `--rb-muted`, 모서리 4px. hover는 배경 `--rb-hover` + 글자 `--rb-fg`. 아이콘 없음.
  - 문구: 평소 **`복사`** → 눌러서 성공하면 **`복사됨`**(1.5초 뒤 `복사`로 복귀). 실패하면 **`복사 실패`**(2초). 버튼 폭이 변하지 않게 `min-w-[3.5rem]` 가운데 정렬.
  - 읽기 화면: 평소엔 `opacity: 0`, `pre:hover`·`pre:focus-within`에서 `opacity: 1`(전환 없음). 터치(`hover: none`)에서는 항상 보인다. 에디터에서는 **편집 중 방해되지 않게** 같은 규칙 + `contenteditable=false`.
  - 접근성: `<button type="button">`, `aria-label="코드 복사"`, 결과는 `role="status"`의 sr-only 영역에 "복사됨" 알림. 키보드 Tab으로 도달(순서: 코드 블록 앞), Enter·Space 동작.
  - 포커스: 전역 규칙과 같게 `outline: 2px solid var(--rb-accent)`, `outline-offset: 1px`(라이트 5.5:1 / 다크 6.7:1). 포커스 중에는 `opacity: 1` 유지.
  - 터치 영역: 높이 24px는 보조 수단이므로 `before` 가상 요소로 히트 영역을 `min 32 × 32`까지 늘린다(레이아웃 불변).
- 긴 코드가 가로로 넘칠 때 버튼이 가려지지 않도록 바는 **스크롤 컨테이너(`pre`) 바깥**, 래퍼 안에 둔다.
- 포커스 outline(2px + offset 1px)이 래퍼의 `overflow: hidden`에 잘리지 않도록 버튼 위아래에 4px 이상 남긴다(띠 2rem − 버튼 1.5rem).

### 2.1 가로 스크롤

- 코드 줄은 **접지 않는다**: `white-space: pre`, `overflow-x: auto`. Tiptap이 layer 밖에서 `.ProseMirror pre { white-space: pre-wrap }`을 넣으므로 이 규칙만 globals.css 끝에 **layer 밖**으로 둔다(`.rb-prose.ProseMirror pre`).
- 스크롤바는 `scrollbar-width: thin`, 색 `--rb-border-strong` / 투명 트랙.

## 3. 노트 템플릿 5종 (`src/lib/templates.ts` 상수)

문구는 짧은 한국어, 빈 칸은 안내문 없이 **제목만** 둔다(지우는 수고를 줄이려고). 날짜는 서울 날짜(`seoulDate`)를 `YYYY-MM-DD`로 치환한다. 본문은 Markdown, 제목 단계는 `##`부터(노트 제목이 h1 자리).

### 3.1 빈 페이지 (`blank`)
- 한 줄 설명: 아무것도 없는 상태에서 시작해요.
- 본문: (빈 문자열)

### 3.2 작업 로그 (`worklog`)
- 한 줄 설명: 오늘 한 일과 다음에 할 일을 날짜별로 남겨요.
- 본문:

```markdown
## YYYY-MM-DD

### 한 일
- 

### 막힌 점
- 

### 다음에 할 일
- 
```

### 3.3 개념 정리 (`concept`)
- 한 줄 설명: 개념을 내 말로 풀고 예시와 연결을 적어요.
- 본문:

```markdown
## 한 줄 정의

## 왜 필요한가

## 핵심 내용
- 

## 예시

## 헷갈리는 점

## 관련 개념
- 
```

### 3.4 에러 해결 (`error`)
- 한 줄 설명: 증상, 원인, 해결을 남겨 다음에 바로 찾아요.
- 본문:

```markdown
## 증상

```text
(에러 메시지)
```

## 원인

## 해결

```bash
```

## 참고
- 
```

(구현 시 안쪽 코드 펜스는 문자열 상수라 그대로 쓴다. 바깥 문서 펜스는 이 문서 표기용이다.)

### 3.5 강의·책 요약 (`summary`)
- 한 줄 설명: 강의나 책의 핵심과 내 생각을 정리해요.
- 본문:

```markdown
## 출처
- 제목: 
- 저자·강사: 
- 범위: 

## 한 줄 요약

## 핵심 내용
- 

## 인상 깊은 부분
> 

## 내 생각·적용

## 더 볼 것
- 
```

## 4. 템플릿 고르는 UI (`/notes/new`)

간단한 **카드 목록 한 줄** — 새 화면을 만들지 않고 `/notes/new` 위쪽에 둔다.

- 위치: 페이지 제목 아래, 편집 폼 위. 라벨 `text-[13px] text-muted` "템플릿".
- 모양: 5개 **세그먼트형 선택 카드**(graph.md 7절 세그먼트와 같은 톤). 가로로 나열, 폭 < 640px이면 세로 쌓기. 카드는 `min-h-[56px] px-3 py-2`, 테두리 `1px --rb-code-border`, 모서리 8px, 바탕 `--rb-bg`. 첫 줄 이름 `text-[14px] font-medium text-fg`, 둘째 줄 한 줄 설명 `text-[12px] text-muted`(3.2·3.3·3.4·3.5·3.1의 설명은 한 줄에 맞춰 짧게).
- 선택 상태: 테두리 `--rb-accent`, 바탕 `--rb-accent-soft`. 기본 선택은 **빈 페이지**.
- 접근성: `role="radiogroup" aria-label="템플릿"`, 카드는 `role="radio" aria-checked`, ←/→(↑/↓)로 이동·선택, Tab으로 그룹 진입. 포커스는 전역 outline 2px accent.
- 동작: 카드를 고르면 본문이 템플릿으로 채워진다. **본문을 이미 입력했다면** 덮어쓰지 않고 선택만 바꾸며, 저장 전에 "본문이 비어 있을 때만 적용돼요"는 따로 안내하지 않는다(입력 전에만 고르게 하는 것이 기본). 저장하면 URL `?template=worklog` 같은 쿼리는 필요 없다(상태만 사용).
- 사용자가 템플릿을 바꾸고 본문이 **템플릿 원문 그대로**이면 새 템플릿으로 교체, 아니면 교체하지 않는다.
- 선택 변경 시 `aria-live="polite"`로 "템플릿: 작업 로그".
