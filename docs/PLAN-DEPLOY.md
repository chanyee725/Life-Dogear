# 계획: 클라우드 배포 — 나만 쓰기 (단계 D)

> **승인됨 (2026-11-04)**. 구성(사용자 확정): 웹 = Vercel Hobby(`*.vercel.app`), DB = Turso, 사진·PDF = Cloudflare R2, 로그인 = Google.
> 실제 배포와 외부 계정 작업은 사용자가 한다(`docs/DEPLOY.md` 체크리스트). 세션은 `.env`를 읽거나 출력하지 않는다. 이메일 주소는 코드·테스트·문서·커밋에 쓰지 않는다(예시는 `you@example.com`). `src/app/loading.tsx` 금지. 새 의존성은 `next-auth` 하나로 최소화(서명은 기존 `aws4fetch`).

## 1. Google 로그인 (나만)

- Auth.js(`next-auth` v5) Google provider, **JWT 세션**(DB 어댑터 없음).
- 허용 목록: `ALLOWED_EMAILS`(쉼표 구분, 대소문자 무시)에 있는 이메일만. 아니면 **거부 화면**("이 계정은 사용할 수 없습니다").
- 미들웨어: 기존 `src/middleware.ts`의 Host 검사(ALLOWED_HOSTS) 다음에 인증 검사. 페이지와 `/api/**` 전부 보호. 제외: `/_next/**`, 정적 자원(아이콘·manifest), `/api/auth/**`, 로그인·거부·설정 안내 화면. API는 401 JSON, 페이지는 로그인으로 리디렉션. 기존 같은 출처 검사는 그대로.
- **모드 판정** (`src/lib/auth/mode.ts`, 순수 함수 + 테스트):
  - `AUTH_SECRET`·`AUTH_GOOGLE_ID`·`AUTH_GOOGLE_SECRET`·`ALLOWED_EMAILS`가 모두 있으면 → 로그인 필수.
  - 없고 로컬(`127.0.0.1`/`localhost`, `VERCEL` 아님) → 지금처럼 로그인 없이.
  - 없는데 `VERCEL=1`이거나 `NODE_ENV=production`+원격 호스트 → **열지 않고 설정 안내 화면**(실수로 공개 방지).
- 사이드바에 "로그아웃"(로그인 모드일 때만).
- `.env.example`에 빈 키: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS`.

## 2. Vercel 4.5MB 한도 → R2 presigned URL

- s3 모드에서만. 로컬 모드는 지금 방식 유지.
- **업로드**: ① `POST /api/uploads/sign` {kind: image|pdf, size, contentType, target} — 로그인·같은 출처·타입·크기 검증 후 짧은 만료(5분) presigned PUT + 임시 키(`pending/<uuid>`) 발급 ② 브라우저가 R2에 직접 PUT ③ `POST /api/uploads/confirm` — 서버가 Range GET으로 앞부분을 읽어 매직바이트(PDF `%PDF-`, 이미지 종류, SVG·HEIC 거부)·크기 확인 → 최종 키로 복사(또는 서명된 이름 그대로 확정) 후 DB 반영. 실패하면 임시 객체 삭제. 남은 `pending/`은 gc가 정리.
- **보기**: `/api/images/...`, `/api/papers/[id]/pdf`는 s3 모드에서 로그인 확인 후 짧은 만료(5분) presigned GET으로 302. pdf.js의 Range 요청은 R2가 직접 받는다. 응답 헤더(Content-Type, `nosniff`, Content-Disposition inline)는 presigned 쿼리(`response-content-type` 등)로 고정.
- 서명은 `aws4fetch`의 `signQuery`. 키·엔드포인트는 서버에서만.
- R2 버킷 CORS 예시(허용 출처 = 내 Vercel 주소, GET/PUT/HEAD, `Range`·`Content-Type` 헤더, `Content-Range`·`Content-Length`·`ETag` 노출)는 `docs/DEPLOY.md`에.

## 3. Vercel에서 동작

- Vercel에서는 로컬 파일시스템(DATA_DIR) 쓰기 금지 → s3 모드 필수, 없으면 설정 안내 화면(1의 안내와 같은 화면).
- pdf.js 워커·cMaps·standard_fonts: 지금 `node_modules`를 읽는 자산 라우트는 Vercel 함수에 파일이 포함되도록 `outputFileTracingIncludes` 설정(또는 빌드 시 `public/`으로 복사). 확인 후 택일.
- `serverExternalPackages` 유지·점검(`@libsql/client`), 함수 실행 시간(그래프·우주 보기·검색 같은 무거운 라우트에 `maxDuration` 필요 여부).
- 마이그레이션은 PC에서 Turso를 대상으로 실행(`DATABASE_URL`·`DATABASE_AUTH_TOKEN`을 잠시 지정하고 `npm run db:migrate`) — 문서화. Vercel 빌드에서는 마이그레이션하지 않는다.

## 4. PWA (오프라인 캐시 없음)

- `src/app/manifest.ts`: name/short_name "Research Brain", `display: standalone`, 테마·배경색은 디자인 토큰.
- 아이콘(조용한 디자인): 192·512·maskable, `apple-touch-icon` 180. 디자이너가 SVG 원본과 PNG를 만든다.
- `viewport-fit=cover` + 아이폰 safe-area(`env(safe-area-inset-*)`) 여백: 사이드바 서랍·상단 바·하단 고정 요소.

## 5. `docs/DEPLOY.md` (사용자 체크리스트)

Google Cloud OAuth 클라이언트(승인된 리디렉션 URI `https://<프로젝트>.vercel.app/api/auth/callback/google`, 로컬 테스트용 `http://127.0.0.1:3000/api/auth/callback/google`) → R2 버킷·API 토큰·CORS → Turso DB·토큰 → Vercel 프로젝트 연결·환경변수(값은 사용자가 직접) → PC에서 첫 마이그레이션·`storage:push` → 첫 로그인 확인 → 아이폰 Safari 공유 → 홈 화면에 추가.

## 6. 담당

| 담당 | 범위 |
|---|---|
| 구현자 A | 1 전체, 3의 "Vercel에서 s3 필수 안내", 4 PWA(아이콘 파일은 디자이너), 5 문서(로그인·Vercel·Turso·PWA 부분). 소유: `src/lib/auth/**`, `src/auth.ts`, `src/app/api/auth/**`, `src/middleware.ts`, `src/app/(auth)/**`(로그인·거부·설정 안내), `src/app/manifest.ts`, `src/app/layout.tsx`(viewport·아이콘 메타만), `src/components/shell/**`(로그아웃·safe-area), `package.json`, `.env.example`, `docs/DEPLOY.md` |
| 구현자 B | 2 전체, 3의 pdf.js 자산·`next.config.ts`·`maxDuration`. 소유: `src/lib/storage/**`, `src/app/api/{uploads,images,papers,pdfjs}/**`, 업로드하는 클라이언트 부분(에디터 사진 업로드, 논문 PDF 패널), `next.config.ts`, `docs/DEPLOY.md`의 R2·CORS 절(A와 절 단위로 나눔) |
| 디자이너 | 아이콘(SVG 원본 + PNG), 로그인·거부·설정 안내 화면 문구·레이아웃(조용한 규칙) — 짧게 |
| 리뷰어 | 전체. 인증 우회(미들웨어 matcher 누락, API 보호), 허용 목록 비교, 실수 공개 방지, presigned URL 범위·만료·키 노출, 업로드 확정 검증, 이메일·비밀값 노출 |
