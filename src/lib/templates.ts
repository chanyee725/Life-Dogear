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
