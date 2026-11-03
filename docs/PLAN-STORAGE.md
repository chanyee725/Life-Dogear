# 계획: 파일 공유 저장소 + 다듬기 (단계 S)

> **승인됨 (2026-11-04)**. 기준: develop `9d4ae61`. `src/app/loading.tsx`는 넣지 않는다. `areas.pinned_at`은 그대로 둔다.

## 1. 공유 저장소 (최우선)

**문제**: 사진은 `DATA_DIR/images`, PDF는 `DATA_DIR/pdfs`에 로컬 파일로 저장된다. Turso로 PC 두 대가 DB를 공유하면 다른 PC에서는 파일이 없어 깨진다.

**설계**
- `src/lib/storage/blob.ts`: 저장소 추상화 `BlobStore { put(key, bytes, contentType), get(key, range?) → stream+meta | null, head(key), delete(key), list(prefix) }`.
  - `local`: 지금과 같은 `DATA_DIR` 아래 파일.
  - `s3`: S3 호환(R2). `.env`에 `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`가 모두 있으면 사용(`S3_REGION` 선택, 기본 `auto`). 키는 `images/<name>`, `pdfs/<id>.pdf`.
  - 서명은 가벼운 순수 JS 라이브러리 `aws4fetch`(의존성 없음)로. 무거운 AWS SDK는 쓰지 않는다.
  - **읽기 폴백**: s3 모드에서 원격에 없고 로컬에 있으면 로컬에서 읽는다.
- `images.ts`, `pdf.ts`는 이 추상화를 쓴다. 브라우저 URL(`/api/images/...`, `/api/papers/[id]/pdf`)은 그대로이고 서버가 프록시한다(키 노출 없음, 공개 버킷 불필요). PDF Range 요청은 원격 Range GET으로 전달.
- 기존 보안 규칙 유지: 매직바이트 검사, SVG 금지, 이름 정규식, 크기 제한, 같은 출처 검사.
- `.env.example`에 빈 키만 추가. `.env`는 읽거나 출력하지 않는다(설정 확인은 앱 로더로 "s3 사용 여부"만).
- `npm run storage:push`: 로컬 파일을 버킷으로 1회 업로드. 이미 있는 키는 건너뜀, `--dry-run` 지원, 결과는 개수만 출력.
- 테스트: S3는 `fetch` 목으로(서명 헤더·경로·Range·404·폴백). minio 불필요.
- README와 `scripts/setup.sh`에 R2 설정 안내.

## 2. 작은 문제

| 항목 | 내용 |
|---|---|
| 모바일 사이드바 버튼 | 390px에서 열기 버튼(끝 44px)과 페이지 제목(시작 40px)이 겹침 → 제목 쪽에 여백 |
| 안 쓰는 사진 정리 | 모든 본문에서 참조되지 않는 사진을 찾아 지움. 생성 후 일정 시간(24시간) 지난 것만, `--dry-run` 기본, 스크립트(`npm run storage:gc-images`) |
| HEIC | 업로드 시 JPG 변환 — 가볍고 순수 JS/wasm인 의존성이 있으면 적용, 아니면 지금 안내 유지하고 보고 |

## 3. 단계 T에서 미룬 다듬기

마감 지남 숫자 빨간색 · 리눅스/윈도우에서 ⌘ 대신 Ctrl 표시 · 할 일 끌어놓기 순서 바꾸기 · 삭제 되돌리기 시 원래 위치 · 그래프 필터 바 1280px 두 줄 넘침 · 할 일 켠 뒤 화면 맞춤 · 빠른 캡처 생각 칸 높이(rows 3, 최대 12줄) · 홈의 불필요한 은하 계산 제거.

## 4. 담당

| 담당 | 범위 |
|---|---|
| 구현자 A | 1 전체 + 2의 사진 정리·HEIC (`src/lib/storage/**`, `src/app/api/images/**`, `src/app/api/papers/**`, `scripts/**`, `package.json`, `.env.example`, `README.md`) |
| 구현자 B | 2의 모바일 사이드바 + 3 전체 (`src/components/{shell,tasks,graph,capture,dashboard}/**`, `src/lib/cosmos/**` 홈용 가벼운 점수 진입점, `src/app/tasks/**`, `src/app/page.tsx`) |
| 리뷰어 | 전체. 저장소는 보안(키 노출·경로 조작·크기)과 데이터 유실(정리 기능) 중점 |

새 마이그레이션은 필요 없을 것으로 본다. 필요해지면 루트 DB에 적용하지 않고 보고한다.
