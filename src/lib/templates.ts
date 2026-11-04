/** Default markdown bodies for new items (SPEC §3 "양식"). */

export const PAPER_TEMPLATE = `## 왜 읽나


## 핵심 내용

### 연구 질문


### 주장


### 기여


## 방법론


## 주요 결과


## 한계


## 인용할 부분


## 내 생각


## 라이너 스콜라 메모

`;

export const SEMINAR_TEMPLATE = `## 현장 메모


## 핵심 3가지

1. 
2. 
3. 

## 인상 깊은 점


## 남은 질문


## 언급된 논문


## 내 연구에 적용할 것

`;

export const PROJECT_TEMPLATE = `## 진행 체크리스트

- [ ] 주제 탐색
- [ ] 주제 확정
- [ ] 제안서 작성
- [ ] 문헌 검토
- [ ] 데이터 수집
- [ ] 초안 작성
- [ ] 수정·교정
- [ ] 제출 완료

## 후보 주제 비교표

| 후보 주제 | 연구 질문 | 장점 | 단점 | 데이터·자료 확보 |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
|  |  |  |  |  |

## 초안 구조

### 초록


### 서론


### 이론적 배경·선행 연구


### 연구 방법


### 결과


### 논의


### 결론


### 참고문헌


## 피드백 기록

| 날짜 | 누구에게서 | 피드백 | 반영 여부 |
| --- | --- | --- | --- |
|  |  |  |  |
`;

export const TEMPLATES = {
  project: PROJECT_TEMPLATE,
  paper: PAPER_TEMPLATE,
  seminar: SEMINAR_TEMPLATE,
  thought: "",
} as const;

/** Note templates offered on /notes/new (docs/design/code.md 3). Order is the picker order. */
export type NoteTemplateKey = "blank" | "worklog" | "concept" | "error" | "summary";

export type NoteTemplate = {
  key: NoteTemplateKey;
  name: string;
  description: string;
  /** Markdown body; `today` is the Seoul date as `YYYY-MM-DD` (`seoulDate()`). */
  body: (today: string) => string;
};

export const NOTE_TEMPLATES: readonly NoteTemplate[] = [
  {
    key: "blank",
    name: "빈 페이지",
    description: "아무것도 없는 상태에서 시작해요.",
    body: () => "",
  },
  {
    key: "worklog",
    name: "작업 로그",
    description: "오늘 한 일과 다음에 할 일을 날짜별로 남겨요.",
    body: (today) => `## ${today}

### 한 일
- 

### 막힌 점
- 

### 다음에 할 일
- 
`,
  },
  {
    key: "concept",
    name: "개념 정리",
    description: "개념을 내 말로 풀고 예시와 연결을 적어요.",
    body: () => `## 한 줄 정의

## 왜 필요한가

## 핵심 내용
- 

## 예시

## 헷갈리는 점

## 관련 개념
- 
`,
  },
  {
    key: "error",
    name: "에러 해결",
    description: "증상, 원인, 해결을 남겨 다음에 바로 찾아요.",
    body: () => `## 증상

\`\`\`text
(에러 메시지)
\`\`\`

## 원인

## 해결

\`\`\`bash
\`\`\`

## 참고
- 
`,
  },
  {
    key: "summary",
    name: "강의·책 요약",
    description: "강의나 책의 핵심과 내 생각을 정리해요.",
    body: () => `## 출처
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
`,
  },
];

export const DEFAULT_NOTE_TEMPLATE: NoteTemplateKey = "blank";

export function noteTemplate(key: NoteTemplateKey): NoteTemplate {
  return NOTE_TEMPLATES.find((t) => t.key === key) ?? NOTE_TEMPLATES[0]!;
}
