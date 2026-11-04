# 배포 체크리스트 (나만 쓰기)

Research Brain을 Vercel에 올려 휴대폰·다른 PC에서도 쓰는 순서입니다. 모든 외부 계정 작업과 값 입력은 직접 합니다. 비밀값(토큰·시크릿)은 이 문서·저장소·채팅 어디에도 적지 말고 각 서비스 화면과 Vercel 환경변수에만 넣으세요.

구성: 웹 = Vercel Hobby(`https://<프로젝트>.vercel.app`), DB = Turso, 사진·PDF = Cloudflare R2, 로그인 = Google.

## 0. 앱이 여는 방식

환경변수에 따라 세 가지로 동작합니다.

| 상태 | 동작 |
|---|---|
| `AUTH_SECRET`·`AUTH_GOOGLE_ID`·`AUTH_GOOGLE_SECRET`·`ALLOWED_EMAILS` 네 개 모두 있음 | Google 로그인 필수. `ALLOWED_EMAILS`에 있는 계정만 들어옵니다. |
| 네 개 모두 비어 있고 이 컴퓨터(`127.0.0.1`/`localhost`)에서 실행 | 지금처럼 로그인 없이 열립니다. |
| 일부만 채움, 또는 Vercel·원격 운영 서버인데 비어 있음 | 앱을 열지 않고 **설정 안내 화면**에 채워야 할 환경변수 이름을 보여 줍니다. |

Vercel에서는 사진·PDF를 R2에 저장해야 합니다(`S3_*` 네 개). 비어 있으면 역시 설정 안내 화면이 나옵니다.

로그인하지 않은 요청은 페이지면 `/login`으로 이동하고, `/api/**`는 `401` JSON(`{"error":"로그인이 필요합니다."}`)을 받습니다. 허용 목록에 없는 Google 계정은 "이 계정은 사용할 수 없습니다" 화면으로 가고 세션이 만들어지지 않습니다.

## 1. Google 로그인 (OAuth 클라이언트)

1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 만들기(또는 선택).
2. **API 및 서비스 → OAuth 동의 화면**: 사용자 유형 "외부", 앱 이름 `Research Brain`. 게시 상태는 "테스트"로 두고 **테스트 사용자**에 본인 Google 계정만 추가합니다.
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**, 유형 "웹 애플리케이션".
4. **승인된 리디렉션 URI**에 추가:
   - `https://<프로젝트>.vercel.app/api/auth/callback/google`
   - (PC에서 로그인까지 시험하려면) `http://localhost:3000/api/auth/callback/google`
5. 만든 클라이언트 ID → `AUTH_GOOGLE_ID`, 클라이언트 보안 비밀 → `AUTH_GOOGLE_SECRET`.
6. `AUTH_SECRET`은 임의의 긴 문자열입니다. 터미널에서 `openssl rand -base64 32` 결과를 그대로 씁니다(어디에도 저장하지 말고 바로 Vercel에 붙여 넣기).
7. `ALLOWED_EMAILS`: 들어올 Google 계정, 쉼표로 구분(대소문자 무시). 예: `you@example.com`

> PC에서 로그인 시험은 `http://localhost:3000`으로 여세요. Next가 미들웨어 리디렉션에서 `127.0.0.1`을 `localhost`로 바꾸므로, `127.0.0.1`로 시작하면 로그인 쿠키와 주소가 어긋납니다.

## R2 (사진·PDF)

## 2. Turso (DB)

1. [Turso](https://turso.tech/)에 가입하고 DB를 만듭니다(지역은 가까운 곳, 예: 도쿄).
2. DB 주소(`libsql://<db>-<계정>.turso.io`) → `DATABASE_URL`.
3. DB 토큰 만들기(읽기·쓰기) → `DATABASE_AUTH_TOKEN`.

### 첫 마이그레이션 (PC에서)

Vercel 빌드는 마이그레이션을 하지 않습니다. 스키마는 PC에서 Turso를 대상으로 올립니다. 이후 스키마가 바뀐 버전을 배포할 때마다 같은 명령을 **배포 전에** 한 번 실행합니다.

```bash
# 이 셸에서만 잠시 지정합니다. 토큰은 화면에 보이지 않게 입력합니다.
read -r -p "DATABASE_URL: " DATABASE_URL
read -r -s -p "DATABASE_AUTH_TOKEN: " DATABASE_AUTH_TOKEN; echo
export DATABASE_URL DATABASE_AUTH_TOKEN
npm run db:migrate
unset DATABASE_URL DATABASE_AUTH_TOKEN
```

PC에 있던 노트를 옮기려면 로컬 DB 대신 Turso를 쓰도록 `.env`에 같은 두 값을 넣고 쓰던 방식대로 이어 쓰면 됩니다(로컬 SQLite 파일의 내용은 자동으로 옮겨지지 않습니다). 사진·PDF는 R2 절의 `npm run storage:push`로 버킷에 올립니다.

## 3. Vercel

1. [Vercel](https://vercel.com/)에서 **Add New → Project** → 이 저장소(GitHub) 가져오기. Framework는 Next.js 자동 인식, 빌드 명령·출력은 기본값.
2. **Settings → Environment Variables** (Production)에 값을 직접 입력합니다.

   | 이름 | 값 |
   |---|---|
   | `AUTH_SECRET` | 1절 6번 |
   | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | 1절 5번 |
   | `ALLOWED_EMAILS` | 1절 7번 |
   | `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | 2절 |
   | `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | R2 절 |
   | `ALLOWED_HOSTS` | `<프로젝트>.vercel.app` |

   - `ALLOWED_HOSTS`가 없으면 Host 검사에서 403 "허용되지 않은 주소입니다"가 나옵니다. 미리보기(Preview) 배포 주소는 일부러 넣지 않습니다(그 주소로는 열리지 않음).
   - `DATA_DIR`·`BLOB_STORE`는 넣지 않습니다.
3. **Deploy**. 환경변수를 바꾼 뒤에는 **Deployments → Redeploy**해야 반영됩니다.
4. 설정 안내 화면이 나오면 화면에 적힌 환경변수 이름을 확인해 채우고 다시 배포합니다.

## 4. 첫 로그인 확인

1. `https://<프로젝트>.vercel.app`을 엽니다 → `/login` 화면.
2. **Google로 로그인** → 허용한 계정 선택 → 홈 화면이 열리면 성공.
3. 다른 Google 계정(또는 시크릿 창)으로 시도하면 "이 계정은 사용할 수 없습니다"가 나와야 합니다.
4. 사진 한 장 붙여 넣기, PDF 하나 올리기·열기를 확인합니다.

문제가 생기면:

- **redirect_uri_mismatch**: 1절 4번의 리디렉션 URI가 실제 주소와 정확히 같은지(https, 끝 경로) 확인.
- **로그인 후 다시 로그인 화면**: `ALLOWED_EMAILS`에 그 계정이 있는지, 바꾼 뒤 Redeploy했는지 확인.
- **403 허용되지 않은 주소**: `ALLOWED_HOSTS`에 `<프로젝트>.vercel.app`이 있는지 확인.
